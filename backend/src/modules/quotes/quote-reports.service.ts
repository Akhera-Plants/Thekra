import { createHmac } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { ReportReason } from './dto/report-quote.dto.js';

/**
 * Limits of the public «أبلغ عن خطأ» endpoint (round 6, C-01s). They are kept in the database, so they hold across
 * serverless instances (the in-memory @Throttle of 5 a minute per address does not).
 */
export const REPORT_LIMITS = {
  /** Reports one reporter (account, or address for the day) may send in an hour and in a day. */
  perReporterHour: 10,
  perReporterDay: 30,
  /** The same reporter, text and reason within this window is answered «received» and not stored again. */
  dedupeHours: 24,
  /** All reports of a UTC day; past it the endpoint answers 429 REPORTS_PAUSED until 00:00 UTC. */
  globalDaily: 1000,
  /**
   * Distinct reporters on one open flag before it turns HIGH (which hides the text until a reviewer looks). Hadith
   * only: a report on a verse or another text (owner round 6, C-01n: «أبلغ عن خطأ» under «وجه التذكير» of every text)
   * reaches the review desk as MEDIUM and never hides the text — anonymous reports must not be able to take a verse
   * of the Qur'an off the site.
   */
  escalateReporters: 3,
  /** Newest report entries copied into the open QuoteFlag for the review desk; older ones stay in QuoteReport. */
  flagEntries: 20,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Control characters (except new line and tab) and bidi overrides/isolates are removed from the note. */
const UNSAFE_CHARS = /[^\P{Cc}\n\t]|[\u202A-\u202E\u2066-\u2069]/gu;

export interface Reporter {
  /** The signed-in account (optional auth); its reports count per account, on any address. */
  userId?: string;
  /** The client address (Express `req.ip`, behind TRUST_PROXY). Hashed with the day; never stored. */
  ip?: string;
}

export interface ReportEntry {
  reason: string;
  note: string | null;
  at: string;
}

/** Trimmed note without control or direction-override characters, at most two blank lines in a row; empty → null. */
export function cleanReportNote(note: string | undefined): string | null {
  if (note === undefined) return null;
  const cleaned = note.replace(UNSAFE_CHARS, '').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function utcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function reportEntries(details: Prisma.JsonValue | null): ReportEntry[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const reports = (details as { reports?: unknown }).reports;
  return Array.isArray(reports) ? (reports as ReportEntry[]) : [];
}

function totalOf(details: Prisma.JsonValue | null): number {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return 0;
  const total = (details as { total?: unknown }).total;
  return typeof total === 'number' ? total : reportEntries(details).length;
}

/**
 * Public mistake reports: no login needed, abuse-limited. Each request does a fixed number of indexed queries
 * (one parallel wave of five reads, then at most one short transaction), whatever was sent before.
 */
@Injectable()
export class QuoteReportsService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables>,
  ) {
    // A key of its own, derived from the access-token secret (no new environment variable): the hash cannot be
    // recomputed from an address or a user id without the server secret.
    const secret = config.get('JWT_ACCESS_SECRET') ?? '';
    this.hashKey = createHmac('sha256', secret).update('thekra:quote-report-reporter:v1').digest();
  }

  /** A signed-in reporter is one key on every address; an anonymous one is the address, for that UTC day only. */
  reporterKey(reporter: Reporter, now: Date): string {
    const hash = (value: string) => createHmac('sha256', this.hashKey).update(value).digest('hex').slice(0, 32);
    if (reporter.userId) return `u:${hash(`user:${reporter.userId}`)}`;
    return `a:${hash(`ip:${reporter.ip ?? 'unknown'}:${now.toISOString().slice(0, 10)}`)}`;
  }

  async report(
    quoteId: string,
    reason: ReportReason,
    rawNote: string | undefined,
    reporter: Reporter,
    now = new Date(),
  ): Promise<{ data: { accepted: true } }> {
    const key = this.reporterKey(reporter, now);
    const note = cleanReportNote(rawNote);

    const [quote, today, lastHour, lastDay, duplicate] = await Promise.all([
      this.prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, type: true } }),
      this.prisma.quoteReport.count({ where: { createdAt: { gte: utcMidnight(now) } } }),
      this.prisma.quoteReport.count({ where: { reporterKey: key, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } } }),
      this.prisma.quoteReport.count({ where: { reporterKey: key, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
      this.prisma.quoteReport.findFirst({
        where: { quoteId, reporterKey: key, reason, createdAt: { gt: new Date(now.getTime() - REPORT_LIMITS.dedupeHours * HOUR_MS) } },
        select: { id: true },
      }),
    ]);
    // Any text type (round 6: the reader's «أبلغ عن خطأ» is under «وجه التذكير» of verses too; the hadith-only check
    // came from the first, hadith-grading version of this endpoint).
    if (!quote) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    const canHide = quote.type === QuoteType.HADITH;
    // Already received from this reporter: the same answer, nothing stored again.
    if (duplicate) return { data: { accepted: true } };
    if (today >= REPORT_LIMITS.globalDaily) {
      const retryAfter = Math.ceil((utcMidnight(now).getTime() + DAY_MS - now.getTime()) / 1000);
      throw new HttpException(
        {
          code: 'REPORTS_PAUSED',
          message: 'Reports are paused for today. Please try again tomorrow.',
          details: { retryAfterSeconds: retryAfter },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (lastHour >= REPORT_LIMITS.perReporterHour || lastDay >= REPORT_LIMITS.perReporterDay) {
      throw new HttpException(
        { code: 'REPORT_RATE_LIMITED', message: 'Too many reports from you for now. Thank you; please try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // One report of a text at a time, so two first reports cannot open two flags.
      await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "id" = ${quoteId} FOR UPDATE`;
      await tx.quoteReport.create({ data: { quoteId, reason, note, reporterKey: key, createdAt: now } });
      const open = await tx.quoteFlag.findFirst({
        where: { quoteId, type: 'USER_REPORT', source: 'USER', status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
      });
      const since = open?.createdAt ?? now;
      // Distinct reporters on this open flag, counted up to the threshold only.
      const reporters = await tx.quoteReport.findMany({
        where: { quoteId, createdAt: { gte: since } },
        distinct: ['reporterKey'],
        select: { reporterKey: true },
        take: REPORT_LIMITS.escalateReporters,
      });
      const entry: ReportEntry = { reason, note, at: now.toISOString() };
      const entries = [...reportEntries(open?.details ?? null), entry].slice(-REPORT_LIMITS.flagEntries);
      const details = {
        total: totalOf(open?.details ?? null) + 1,
        reporters: reporters.length,
        reports: entries,
      } as unknown as Prisma.InputJsonValue;
      const severity = canHide && reporters.length >= REPORT_LIMITS.escalateReporters ? 'HIGH' : 'MEDIUM';
      if (open) {
        await tx.quoteFlag.update({ where: { id: open.id }, data: { details, severity } });
      } else {
        await tx.quoteFlag.create({
          data: { quoteId, type: 'USER_REPORT', severity, source: 'USER', details, createdAt: now },
        });
      }
    });
    return { data: { accepted: true } };
  }
}
