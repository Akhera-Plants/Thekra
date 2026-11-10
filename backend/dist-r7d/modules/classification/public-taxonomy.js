import { EntityOrigin, LinkReviewStatus } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
export function isAutoChapter(origin) {
    return origin === EntityOrigin.AUTO_CHAPTER;
}
export function isPublicTopic(row) {
    if (!row || row.isHidden)
        return false;
    const origin = row.origin ?? EntityOrigin.CURATED;
    return origin === EntityOrigin.CURATED || origin === EntityOrigin.TAXONOMY;
}
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
export function readerLinkNote(note) {
    if (!note || note.startsWith('باب ') || note.includes('تفسير السعدي') || note.startsWith('أورده '))
        return null;
    return note;
}
//# sourceMappingURL=public-taxonomy.js.map