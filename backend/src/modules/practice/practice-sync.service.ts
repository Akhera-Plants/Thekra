import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';
import {
  MAX_LIVE_PLANS,
  MAX_LIVE_RELATIVES,
  parseSyncRequest,
  planToWire,
  planVersion,
  readPracticeChanges,
  relativeToWire,
  relativeVersion,
  settingsVersion,
  wins,
  type PlanChange,
  type PlanWire,
  type PracticeChangesDto,
  type RelativeChange,
  type RelativeWire,
  type SyncRequest,
} from './practice-sync.js';

/**
 * `serverTime` is the read time minus this margin. A write committed by another
 * device while this request read (its rows stamped a little earlier) is then
 * returned by the next sync instead of being missed; merges are idempotent, so
 * returning an item twice is harmless.
 */
export const SYNC_OVERLAP_MS = 30_000;

type Tx = Prisma.TransactionClient;

function notFound(what: string): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: `${what} not found` });
}

/**
 * Content columns of a tombstone row for an item this server never saw (the device sends only id,
 * clientUpdatedAt and deletedAt). Never sent out: a deleted row is serialised as those three fields.
 */
function tombstonePlan(id: string, clientUpdatedAt: string, deletedAt: string): PlanWire {
  const day = clientUpdatedAt.slice(0, 10);
  return {
    id,
    habitKey: null,
    deedSlug: '',
    title: '',
    unit: 'times',
    amount: 1,
    ceiling: null,
    activeDaysPerWeek: 7,
    slots: [],
    rule: null,
    createdOn: day,
    amountChangedOn: day,
    ebbSince: null,
    season: null,
    clientUpdatedAt,
    deletedAt,
  };
}

function tombstoneRelative(id: string, clientUpdatedAt: string, deletedAt: string): RelativeWire {
  return {
    id,
    name: '',
    relation: '',
    rule: { kind: 'everyNDays', n: 1, anchor: clientUpdatedAt.slice(0, 10) },
    lastContactedOn: null,
    clientUpdatedAt,
    deletedAt,
  };
}

const json = (value: unknown) => (value === null ? null : JSON.stringify(value));

/**
 * Practice sync (docs/plan/2026-10-practice-sync-contract.md §3). One request
 * is one transaction: ownership checks, merges, limits and the response read
 * either all happen or none. Merges are written as single set-based upserts so
 * a 500-item request stays a handful of statements. Which copy wins is decided
 * in code with practice-core `compareVersions` (later clientUpdatedAt; at equal
 * times a tombstone; then the larger canonical JSON), exactly as every device
 * decides; only winners are written, and the `WHERE` of each `ON CONFLICT`
 * still refuses a row a concurrent request has made newer meanwhile. Practice
 * content is never logged. After a sync the user's web push reminders are
 * re-planned (outside the transaction; a failure there never fails the sync).
 */
@Injectable()
export class PracticeSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async changes(userId: string, since: Date | null): Promise<PracticeChangesDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertUser(tx, userId);
      return readPracticeChanges(tx, userId, since, await this.serverTime(tx));
    });
  }

  async sync(userId: string, body: unknown): Promise<PracticeChangesDto> {
    const request = parseSyncRequest(body);
    const response = await this.prisma.$transaction(
      async (tx) => {
        await this.assertUser(tx, userId);
        const plans = await this.resolvePlans(tx, userId, request);
        const relatives = await this.resolveRelatives(tx, userId, request);
        if (request.settings && (await this.settingsWin(tx, userId, request.settings))) {
          await this.upsertSettings(tx, userId, request.settings);
        }
        await this.upsertPlans(tx, userId, plans);
        await this.upsertLogs(tx, request);
        await this.upsertRelatives(tx, userId, relatives);
        await this.upsertContacts(tx, request);
        await this.assertLimits(tx, userId, request);
        return readPracticeChanges(tx, userId, request.since, await this.serverTime(tx), {
          settings: request.settings !== null,
          planIds: request.plans.map((change) => (change.kind === 'live' ? change.plan.id : change.id)),
          logKeys: request.logs.map(({ planId, date }) => ({ planId, date })),
          relativeIds: request.relatives.map((change) => (change.kind === 'live' ? change.relative.id : change.id)),
          contactKeys: request.contacts.map(({ relativeId, date }) => ({ relativeId, date })),
        });
      },
      { maxWait: 5_000, timeout: 20_000 },
    );
    const changed =
      request.settings !== null ||
      request.plans.length + request.logs.length + request.relatives.length + request.contacts.length > 0;
    // An empty sync (the periodic check) changes no reminder; the daily refill carries them over midnight.
    if (changed) await this.push.replanUser(userId);
    return response;
  }

  private async assertUser(tx: Tx, userId: string): Promise<void> {
    if ((await tx.user.count({ where: { id: userId } })) === 0) throw notFound('User');
  }

  private async serverTime(tx: Tx): Promise<Date> {
    const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
    return new Date((row?.now ?? new Date()).getTime() - SYNC_OVERLAP_MS);
  }

  /**
   * Ids already owned by another user, and logs for a plan that is neither the
   * user's nor in this request, make the whole request 404 (nothing applied).
   * Returns the incoming plans that win over the stored copy, ready to write; a
   * tombstone keeps the stored content columns of the plan it deletes, and its
   * logs (a newer edit may restore the plan).
   */
  private async resolvePlans(tx: Tx, userId: string, request: SyncRequest): Promise<PlanWire[]> {
    const incomingIds = request.plans.map((change) => (change.kind === 'live' ? change.plan.id : change.id));
    const ids = [...new Set([...incomingIds, ...request.logs.map((log) => log.planId)])];
    const existing = ids.length ? await tx.habitPlan.findMany({ where: { id: { in: ids } } }) : [];
    if (existing.some((row) => row.userId !== userId)) throw notFound('Plan');
    const owned = new Set([...existing.map((row) => row.id), ...incomingIds]);
    if (request.logs.some((log) => !owned.has(log.planId))) throw notFound('Plan');
    const stored = new Map(existing.map((row) => [row.id, row]));
    const storedVersion = (row: (typeof existing)[number]) =>
      planVersion(
        row.deletedAt
          ? { kind: 'tombstone', id: row.id, clientUpdatedAt: row.clientUpdatedAt.toISOString(), deletedAt: row.deletedAt.toISOString() }
          : { kind: 'live', plan: planToWire(row) },
      );
    return request.plans.flatMap((change: PlanChange) => {
      const row = stored.get(change.kind === 'live' ? change.plan.id : change.id);
      if (!wins(row ? storedVersion(row) : null, planVersion(change))) return [];
      if (change.kind === 'live') return [change.plan];
      const base = row ? planToWire(row) : tombstonePlan(change.id, change.clientUpdatedAt, change.deletedAt);
      return [{ ...base, clientUpdatedAt: change.clientUpdatedAt, deletedAt: change.deletedAt }];
    });
  }

  private async resolveRelatives(tx: Tx, userId: string, request: SyncRequest): Promise<RelativeWire[]> {
    const incomingIds = request.relatives.map((change) => (change.kind === 'live' ? change.relative.id : change.id));
    const ids = [...new Set([...incomingIds, ...request.contacts.map((contact) => contact.relativeId)])];
    const existing = ids.length ? await tx.relative.findMany({ where: { id: { in: ids } } }) : [];
    if (existing.some((row) => row.userId !== userId)) throw notFound('Relative');
    const owned = new Set([...existing.map((row) => row.id), ...incomingIds]);
    if (request.contacts.some((contact) => !owned.has(contact.relativeId))) throw notFound('Relative');
    const stored = new Map(existing.map((row) => [row.id, row]));
    const storedVersion = (row: (typeof existing)[number]) =>
      relativeVersion(
        row.deletedAt
          ? { kind: 'tombstone', id: row.id, clientUpdatedAt: row.clientUpdatedAt.toISOString(), deletedAt: row.deletedAt.toISOString() }
          : { kind: 'live', relative: relativeToWire(row) },
      );
    return request.relatives.flatMap((change: RelativeChange) => {
      const row = stored.get(change.kind === 'live' ? change.relative.id : change.id);
      if (!wins(row ? storedVersion(row) : null, relativeVersion(change))) return [];
      if (change.kind === 'live') return [change.relative];
      const base = row ? relativeToWire(row) : tombstoneRelative(change.id, change.clientUpdatedAt, change.deletedAt);
      return [{ ...base, clientUpdatedAt: change.clientUpdatedAt, deletedAt: change.deletedAt }];
    });
  }

  private async settingsWin(tx: Tx, userId: string, settings: NonNullable<SyncRequest['settings']>): Promise<boolean> {
    const row = await tx.practiceSettings.findUnique({ where: { userId } });
    const stored = row
      ? settingsVersion({
          hijriOffset: row.hijriOffset,
          reminderTimes: row.reminderTimes,
          freeMinutesPerDay: row.freeMinutesPerDay,
          clientUpdatedAt: row.clientUpdatedAt.toISOString(),
        })
      : null;
    return wins(stored, settingsVersion(settings));
  }

  /** Writes settings that won (see settingsWin); never over a newer concurrent write. */
  private async upsertSettings(tx: Tx, userId: string, settings: NonNullable<SyncRequest['settings']>): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "PracticeSettings" ("userId", "hijriOffset", "reminderTimes", "freeMinutesPerDay", "clientUpdatedAt", "updatedAt")
      VALUES (${userId}, ${settings.hijriOffset}, ${settings.reminderTimes}::text[], ${settings.freeMinutesPerDay}::int,
              ${settings.clientUpdatedAt}::timestamp(3), now() AT TIME ZONE 'UTC')
      ON CONFLICT ("userId") DO UPDATE SET
        "hijriOffset" = EXCLUDED."hijriOffset",
        "reminderTimes" = EXCLUDED."reminderTimes",
        "freeMinutesPerDay" = EXCLUDED."freeMinutesPerDay",
        "clientUpdatedAt" = EXCLUDED."clientUpdatedAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "PracticeSettings"."clientUpdatedAt" <= EXCLUDED."clientUpdatedAt"`;
  }

  /** Writes plans that won (see resolvePlans); never another user's row or over a newer concurrent write. */
  private async upsertPlans(tx: Tx, userId: string, plans: PlanWire[]): Promise<void> {
    if (plans.length === 0) return;
    const column = <K extends keyof PlanWire>(key: K) => plans.map((plan) => plan[key]);
    await tx.$executeRaw`
      INSERT INTO "HabitPlan" ("id", "userId", "habitKey", "deedSlug", "title", "unit", "amount", "ceiling",
        "activeDaysPerWeek", "slots", "rule", "createdOn", "amountChangedOn", "ebbSince", "season",
        "clientUpdatedAt", "updatedAt", "deletedAt")
      SELECT t.id, ${userId}, t.habit_key, t.deed_slug, t.title, t.unit, t.amount, t.ceiling, t.active_days,
        ARRAY(SELECT jsonb_array_elements_text(t.slots::jsonb)), t.rule::jsonb, t.created_on::date,
        t.amount_changed_on::date, t.ebb_since::date, t.season::jsonb, t.client_updated_at::timestamp(3),
        now() AT TIME ZONE 'UTC', t.deleted_at::timestamp(3)
      FROM unnest(
        ${column('id')}::text[], ${column('habitKey')}::text[], ${column('deedSlug')}::text[], ${column('title')}::text[],
        ${column('unit')}::text[], ${column('amount')}::float8[], ${column('ceiling')}::float8[], ${column('activeDaysPerWeek')}::int[],
        ${plans.map((plan) => JSON.stringify(plan.slots))}::text[], ${plans.map((plan) => json(plan.rule))}::text[],
        ${column('createdOn')}::text[], ${column('amountChangedOn')}::text[], ${column('ebbSince')}::text[],
        ${plans.map((plan) => json(plan.season))}::text[], ${column('clientUpdatedAt')}::text[], ${column('deletedAt')}::text[]
      ) AS t(id, habit_key, deed_slug, title, unit, amount, ceiling, active_days, slots, rule, created_on,
             amount_changed_on, ebb_since, season, client_updated_at, deleted_at)
      ON CONFLICT ("id") DO UPDATE SET
        "habitKey" = EXCLUDED."habitKey", "deedSlug" = EXCLUDED."deedSlug", "title" = EXCLUDED."title",
        "unit" = EXCLUDED."unit", "amount" = EXCLUDED."amount", "ceiling" = EXCLUDED."ceiling",
        "activeDaysPerWeek" = EXCLUDED."activeDaysPerWeek", "slots" = EXCLUDED."slots", "rule" = EXCLUDED."rule",
        "createdOn" = EXCLUDED."createdOn", "amountChangedOn" = EXCLUDED."amountChangedOn",
        "ebbSince" = EXCLUDED."ebbSince", "season" = EXCLUDED."season",
        "clientUpdatedAt" = EXCLUDED."clientUpdatedAt", "updatedAt" = EXCLUDED."updatedAt",
        "deletedAt" = EXCLUDED."deletedAt"
      WHERE "HabitPlan"."userId" = EXCLUDED."userId"
        AND "HabitPlan"."clientUpdatedAt" <= EXCLUDED."clientUpdatedAt"`;
  }

  /**
   * practice-core `mergeLogEntry`: the later correction wins (null = oldest), then the larger amount, so plain
   * logging never goes down and an undo of «تمّ» is not undone by a device that still holds the old amount.
   */
  private async upsertLogs(tx: Tx, request: SyncRequest): Promise<void> {
    if (request.logs.length === 0) return;
    await tx.$executeRaw`
      INSERT INTO "HabitLog" ("planId", "date", "amount", "correctedAt", "updatedAt")
      SELECT t.plan_id, t.date::date, t.amount, t.corrected_at::timestamp(3), now() AT TIME ZONE 'UTC'
      FROM unnest(
        ${request.logs.map((log) => log.planId)}::text[], ${request.logs.map((log) => log.date)}::text[],
        ${request.logs.map((log) => log.amount)}::float8[], ${request.logs.map((log) => log.correctedAt ?? null)}::text[]
      ) AS t(plan_id, date, amount, corrected_at)
      ON CONFLICT ("planId", "date") DO UPDATE SET
        "amount" = EXCLUDED."amount", "correctedAt" = EXCLUDED."correctedAt", "updatedAt" = EXCLUDED."updatedAt"
      WHERE (COALESCE("HabitLog"."correctedAt", '-infinity'::timestamp), "HabitLog"."amount")
          < (COALESCE(EXCLUDED."correctedAt", '-infinity'::timestamp), EXCLUDED."amount")`;
  }

  private async upsertRelatives(tx: Tx, userId: string, relatives: RelativeWire[]): Promise<void> {
    if (relatives.length === 0) return;
    const column = <K extends keyof RelativeWire>(key: K) => relatives.map((relative) => relative[key]);
    await tx.$executeRaw`
      INSERT INTO "Relative" ("id", "userId", "name", "relation", "rule", "lastContactedOn", "clientUpdatedAt",
        "updatedAt", "deletedAt")
      SELECT t.id, ${userId}, t.name, t.relation, t.rule::jsonb, t.last_contacted_on::date,
        t.client_updated_at::timestamp(3), now() AT TIME ZONE 'UTC', t.deleted_at::timestamp(3)
      FROM unnest(
        ${column('id')}::text[], ${column('name')}::text[], ${column('relation')}::text[],
        ${relatives.map((relative) => JSON.stringify(relative.rule))}::text[], ${column('lastContactedOn')}::text[],
        ${column('clientUpdatedAt')}::text[], ${column('deletedAt')}::text[]
      ) AS t(id, name, relation, rule, last_contacted_on, client_updated_at, deleted_at)
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name", "relation" = EXCLUDED."relation", "rule" = EXCLUDED."rule",
        "lastContactedOn" = EXCLUDED."lastContactedOn", "clientUpdatedAt" = EXCLUDED."clientUpdatedAt",
        "updatedAt" = EXCLUDED."updatedAt", "deletedAt" = EXCLUDED."deletedAt"
      WHERE "Relative"."userId" = EXCLUDED."userId"
        AND "Relative"."clientUpdatedAt" <= EXCLUDED."clientUpdatedAt"`;
  }

  /** Union: a contact is added; `deleted: true` tombstones it; a later non-deleted write clears the tombstone. */
  private async upsertContacts(tx: Tx, request: SyncRequest): Promise<void> {
    if (request.contacts.length === 0) return;
    await tx.$executeRaw`
      INSERT INTO "RelativeContact" ("relativeId", "date", "deletedAt", "updatedAt")
      SELECT t.relative_id, t.date::date,
        CASE WHEN t.deleted THEN now() AT TIME ZONE 'UTC' END, now() AT TIME ZONE 'UTC'
      FROM unnest(
        ${request.contacts.map((contact) => contact.relativeId)}::text[], ${request.contacts.map((contact) => contact.date)}::text[],
        ${request.contacts.map((contact) => contact.deleted)}::boolean[]
      ) AS t(relative_id, date, deleted)
      ON CONFLICT ("relativeId", "date") DO UPDATE SET "deletedAt" = EXCLUDED."deletedAt", "updatedAt" = EXCLUDED."updatedAt"
      WHERE ("RelativeContact"."deletedAt" IS NULL) <> (EXCLUDED."deletedAt" IS NULL)`;
  }

  private async assertLimits(tx: Tx, userId: string, request: SyncRequest): Promise<void> {
    const [plans, relatives] = await Promise.all([
      request.plans.length ? tx.habitPlan.count({ where: { userId, deletedAt: null } }) : 0,
      request.relatives.length ? tx.relative.count({ where: { userId, deletedAt: null } }) : 0,
    ]);
    if (plans > MAX_LIVE_PLANS || relatives > MAX_LIVE_RELATIVES) {
      throw new UnprocessableEntityException({
        code: 'PRACTICE_LIMIT_REACHED',
        message: `At most ${MAX_LIVE_PLANS} plans and ${MAX_LIVE_RELATIVES} relatives per account`,
        details: { plans: MAX_LIVE_PLANS, relatives: MAX_LIVE_RELATIVES },
      });
    }
  }
}
