/**
 * The chapter-rule and the Sa'di term matcher wrote entities and links that
 * the owner rejected. The rows stay. Public routes do not serve them.
 */
import { EntityOrigin, LinkReviewStatus } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';

export function isAutoChapter(origin: string | null | undefined): boolean {
  return origin === EntityOrigin.AUTO_CHAPTER;
}

/** Listed pages use isListed as well. A hidden topic, including a leftover kabira, is not public. */
export function isPublicTopic<T extends { origin?: string | null; isHidden?: boolean | null }>(
  row: T | null | undefined,
): row is T {
  if (!row || row.isHidden) return false;
  const origin = row.origin ?? EntityOrigin.CURATED;
  return origin === EntityOrigin.CURATED || origin === EntityOrigin.TAXONOMY;
}

/** A chapter note is «باب …». A Sa'di match cites «تفسير السعدي» and has no curator score. */
export function autoLinkExclusion() {
  return {
    NOT: {
      OR: [
        { note: { startsWith: 'باب ' } },
        {
          AND: [
            { note: { contains: 'تفسير السعدي' } },
            { OR: [{ relevanceScore: null }, { relevanceScore: 0 }] },
          ],
        },
      ],
    },
  };
}

export function publicAcceptedLinkWhere() {
  return {
    reviewStatus: LinkReviewStatus.ACCEPTED,
    quote: GradePolicy.readerClause(),
    ...autoLinkExclusion(),
  };
}

/** The one curated link whose note was overwritten still returns the verse, without the generated sentence. */
export function readerLinkNote(note: string | null | undefined): string | null {
  // «أورده الأستاذ … في حلقة …»: how a lecture text was found, not something the reader needs (owner, 2026-10-29).
  if (!note || note.startsWith('باب ') || note.includes('تفسير السعدي') || note.startsWith('أورده ')) return null;
  return note;
}
