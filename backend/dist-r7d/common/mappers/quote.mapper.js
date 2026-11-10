import { GradeSource } from '@prisma/client';
import { isArnautGradeSource } from '../../modules/hadith/grade-policy.js';
import { STRONG_MATCH_SCORE } from '../text/match-score.js';
import { startsWithNarratorLead } from '../text/matn.js';
import { normalizeMatn } from '../text/normalize-matn.js';
import { formatPrintedReference } from '../text/printed-reference.js';
export const sahihaynMatchInclude = {
    where: { decision: { not: 'REJECTED' }, score: { gte: STRONG_MATCH_SCORE } },
    orderBy: { score: 'desc' },
    take: 1,
    include: { referenceHadith: { select: { matnText: true } } },
};
export const quoteIncludeForDto = {
    source: true,
    translations: true,
    tags: { include: { tag: true } },
    matches: sahihaynMatchInclude,
};
export const quoteDetailIncludeForDto = {
    source: true,
    translations: true,
    tags: { include: { tag: true } },
    matches: sahihaynMatchInclude,
    sinLinks: {
        include: {
            sin: { select: { slug: true, name: true, nameAr: true } },
        },
    },
    goodDeedLinks: {
        include: {
            goodDeed: {
                select: { slug: true, name: true, nameAr: true },
            },
        },
    },
};
const TAIL_WORDS = 8;
export function carriesReferenceMatn(text, referenceMatn) {
    const words = normalizeMatn(text).split(' ').filter(Boolean);
    const reference = normalizeMatn(referenceMatn).split(' ').filter(Boolean);
    const tail = reference.slice(-TAIL_WORDS).join(' ');
    const chainLed = reference.slice(0, 3).some((word) => /^و?(?:حدثنا|حدثني|اخبرنا|اخبرني)$/.test(word));
    return tail.length > 0
        && (words.length >= reference.length + 2 || chainLed)
        && words.join(' ').endsWith(tail)
        && startsWithNarratorLead(text);
}
function publicTextAr(row) {
    if (row.isAthar && row.atharTextAr && row.atharTextAr.trim().length > 0) {
        return row.atharTextAr.trim();
    }
    if (row.gradeSource === GradeSource.AUTO_SAHIHAYN) {
        const reference = row.matches[0]?.referenceHadith.matnText.trim() ?? '';
        const own = row.matnAr?.trim() ?? '';
        if (own && (!reference || carriesReferenceMatn(own, reference)))
            return own;
        return reference || own || row.textAr;
    }
    if (row.matnAr && row.matnAr.trim().length > 0)
        return row.matnAr.trim();
    return row.textAr;
}
function shuabAlsoIn(row, locale) {
    if (row.apiProvider !== 'book:shuab-iman')
        return null;
    if (row.gradeSource !== GradeSource.AUTO_SAHIHAYN &&
        !isArnautGradeSource(row.gradeSource) &&
        row.gradeSource !== GradeSource.HADEETHENC) {
        return null;
    }
    const number = row.referenceNumber;
    if (locale === 'en') {
        return number == null
            ? "Also in Bayhaqi's Shu'ab al-Iman"
            : `Also in Bayhaqi's Shu'ab al-Iman, no. ${number}`;
    }
    return number == null
        ? 'ورد في الجامع لشعب الإيمان للبيهقي'
        : `ورد في الجامع لشعب الإيمان للبيهقي، رقم ${number}`;
}
function isLectureCitation(row) {
    return row.apiProvider?.startsWith('lecture:') ?? false;
}
function lectureWordingNote(row, locale) {
    if (!row.gradeReference?.startsWith('رواه بمعناه'))
        return null;
    return locale === 'ar' ? 'رُوي بالمعنى' : 'Reported by meaning';
}
export function mapQuoteToDto(row, locale) {
    const lecture = isLectureCitation(row);
    const translation = locale === 'ar'
        ? null
        : (row.translations.find((t) => t.languageCode === locale) ?? null);
    return {
        id: row.id,
        type: row.type,
        origin: row.origin,
        textAr: publicTextAr(row),
        translation: translation
            ? { languageCode: translation.languageCode, text: translation.text }
            : null,
        quran: row.type === 'QURAN_VERSE'
            ? {
                surahNumber: row.surahNumber,
                surahName: row.surahName,
                surahNameAr: row.surahNameAr,
                ayahNumber: row.ayahNumber,
            }
            : null,
        hadith: row.type === 'HADITH'
            ? {
                narrator: row.narrator,
                narratorAr: row.narratorAr,
                grade: row.isAthar ? null : row.grade,
                reference: lecture ? null : formatPrintedReference({
                    locale,
                    workAr: row.source.nameAr,
                    workEn: row.source.name,
                    referenceNumber: row.referenceNumber,
                    referenceLabel: row.referenceLabel,
                }),
                outsideSahihayn: isArnautGradeSource(row.gradeSource),
            }
            : null,
        book: row.type === 'BOOK_EXCERPT' || row.type === 'SCHOLAR_QUOTE'
            ? {
                bookTitle: row.bookTitle,
                author: row.author,
                pageOrChapter: row.pageOrChapter,
            }
            : null,
        citation: {
            volume: row.volume,
            page: row.page,
            gradeAuthority: row.isAthar || lecture ? null : row.gradeAuthority,
            gradeReference: row.isAthar ? null : lecture ? lectureWordingNote(row, locale) : row.gradeReference,
            alsoIn: shuabAlsoIn(row, locale),
        },
        source: {
            id: row.source.id,
            name: lecture ? '' : row.source.name,
            nameAr: lecture ? null : row.source.nameAr,
            type: row.source.type,
            author: lecture ? null : row.source.author,
            authorAr: lecture ? null : row.source.authorAr,
            isExternalApi: row.source.isExternalApi,
            apiProvider: row.source.apiProvider,
        },
        tags: row.tags.map(({ tag }) => ({
            id: tag.id,
            slug: tag.slug,
            name: tag.name,
            nameAr: tag.nameAr,
            category: tag.category,
        })),
        textSource: row.textSource,
        textVerifiedAt: row.textVerifiedAt,
        isAthar: row.isAthar,
        atharSpeakerKey: row.atharSpeakerKey,
        atharSpeakerAr: row.atharSpeakerAr,
        atharTextAr: row.atharTextAr,
        atharAttributionKind: row.atharAttributionKind,
        external: row.origin === 'API_CACHED'
            ? { apiProvider: row.apiProvider, externalId: row.externalId }
            : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
//# sourceMappingURL=quote.mapper.js.map