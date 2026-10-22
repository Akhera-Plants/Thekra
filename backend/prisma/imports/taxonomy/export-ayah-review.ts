/**
 * Step 4d — export ACCEPTED verse links from al-Zuhd, Mukhtasar Minhaj,
 * al-Munajjid (AUTHOR_CITATION) or REVIEWER_SECTION for reviewer decisions.
 * Does not change public data.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LinkBasis,
  LinkReviewStatus,
  QuoteType,
  SectionItemKind,
  type PrismaClient,
} from '@prisma/client';

const SOURCE_BOOKS = new Set(['zuhd', 'minhaj', 'munajjid']);

function tsvEscape(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
}

function bookKeyOf(nameAr: string | null, name: string): string | null {
  const hay = `${nameAr ?? ''} ${name}`.toLowerCase();
  if (hay.includes('زهد') || hay.includes('zuhd')) return 'zuhd';
  if (hay.includes('منهاج') || hay.includes('minhaj') || hay.includes('qasidin')) return 'minhaj';
  if (hay.includes('منجد') || hay.includes('munajjid') || hay.includes('قلوب')) return 'munajjid';
  return null;
}

function positionInSection(
  items: Array<{ order: number; kind: SectionItemKind; quoteId: string | null }>,
  quoteId: string,
): string {
  const firstHadith = items.find((item) => item.kind === SectionItemKind.HADITH);
  const ayahItem = items.find(
    (item) => item.kind === SectionItemKind.AYAH && item.quoteId === quoteId,
  );
  if (!firstHadith || (ayahItem && ayahItem.order < firstHadith.order)) return 'opening';
  return 'after first hadith';
}

export async function exportAyahReview(prisma: PrismaClient, outPath: string): Promise<number> {
  const sectionSelect = {
    titleAr: true,
    source: { select: { name: true, nameAr: true } },
    items: {
      orderBy: { order: 'asc' as const },
      select: { order: true, kind: true, quoteId: true },
    },
  };

  const [sinLinks, deedLinks] = await Promise.all([
    prisma.sinQuote.findMany({
      where: {
        reviewStatus: LinkReviewStatus.ACCEPTED,
        quote: { type: QuoteType.QURAN_VERSE },
        OR: [
          { basis: LinkBasis.AUTHOR_CITATION },
          { basis: LinkBasis.REVIEWER_SECTION },
        ],
      },
      select: {
        id: true,
        quoteId: true,
        basis: true,
        sin: { select: { slug: true, nameAr: true } },
        quote: {
          select: {
            textAr: true,
            surahNumber: true,
            ayahNumber: true,
            surahNameAr: true,
          },
        },
        section: { select: sectionSelect },
      },
    }),
    prisma.goodDeedQuote.findMany({
      where: {
        reviewStatus: LinkReviewStatus.ACCEPTED,
        quote: { type: QuoteType.QURAN_VERSE },
        OR: [
          { basis: LinkBasis.AUTHOR_CITATION },
          { basis: LinkBasis.REVIEWER_SECTION },
        ],
      },
      select: {
        id: true,
        quoteId: true,
        basis: true,
        goodDeed: { select: { slug: true, nameAr: true } },
        quote: {
          select: {
            textAr: true,
            surahNumber: true,
            ayahNumber: true,
            surahNameAr: true,
          },
        },
        section: { select: sectionSelect },
      },
    }),
  ]);

  const rows: string[] = [];

  const consider = (
    linkId: string,
    side: 'AVOID' | 'DO',
    slug: string,
    topicName: string,
    quoteId: string,
    basis: LinkBasis,
    quote: {
      textAr: string;
      surahNumber: number | null;
      ayahNumber: number | null;
      surahNameAr: string | null;
    },
    section: {
      titleAr: string;
      source: { name: string; nameAr: string | null };
      items: Array<{ order: number; kind: SectionItemKind; quoteId: string | null }>;
    } | null,
  ): void => {
    if (!section) return;
    const book = bookKeyOf(section.source.nameAr, section.source.name);
    if (!book || !SOURCE_BOOKS.has(book)) return;
    if (basis === LinkBasis.AUTHOR_CITATION && book !== 'munajjid') return;

    rows.push(
      [
        linkId,
        side,
        slug,
        tsvEscape(topicName),
        `${quote.surahNumber ?? 0}:${quote.ayahNumber ?? 0}`,
        tsvEscape(quote.surahNameAr ?? ''),
        tsvEscape(quote.textAr.slice(0, 120)),
        book,
        tsvEscape(section.titleAr),
        positionInSection(section.items, quoteId),
      ].join('\t'),
    );
  };

  for (const link of sinLinks) {
    consider(
      link.id,
      'AVOID',
      link.sin.slug,
      link.sin.nameAr,
      link.quoteId,
      link.basis,
      link.quote,
      link.section,
    );
  }
  for (const link of deedLinks) {
    consider(
      link.id,
      'DO',
      link.goodDeed.slug,
      link.goodDeed.nameAr,
      link.quoteId,
      link.basis,
      link.quote,
      link.section,
    );
  }

  rows.sort((a, b) => a.localeCompare(b, 'ar'));

  const header = [
    'linkId',
    'side',
    'topicSlug',
    'topicName',
    'verseKey',
    'surahName',
    'verseSnippet',
    'book',
    'sectionTitle',
    'positionInSection',
  ].join('\t');

  writeFileSync(resolve(outPath), `${header}\n${rows.join('\n')}\n`, 'utf8');
  return rows.length;
}
