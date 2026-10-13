/**
 * The chapter-rule and the Sa'di term matcher wrote entities and links that
 * the owner rejected. The rows stay. Public routes do not serve them.
 */
import { EntityOrigin, LinkReviewStatus } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';

export function isAutoChapter(origin: string | null | undefined): boolean {
  return origin === EntityOrigin.AUTO_CHAPTER;
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
  if (!note || note.startsWith('باب ') || note.includes('تفسير السعدي')) return null;
  return note;
}
