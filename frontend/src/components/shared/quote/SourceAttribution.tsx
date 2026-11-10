'use client';

import { useLocale } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { englishProvenance } from '@/lib/format/provenance';
import { formatGradeCitation } from '@/lib/format/grade-citation';

function visible(value: string | null | undefined, arabic: boolean): string | null {
  if (!value) return null;
  if (arabic && /[A-Za-z]/.test(value)) return null;
  return value;
}

interface SourceAttributionProps {
  quote: Pick<QuoteDto, 'type' | 'source' | 'quran' | 'hadith' | 'book' | 'citation'>;
  /** Translated labels */
  labels: {
    narrator: string;
    reference: string;
    source: string;
    volume: string;
    page: string;
    gradeAuthority: string;
    gradeReference: string;
  };
  /** When set, the footer is the target of a footnote jump. */
  citationAnchorId?: string;
  /**
   * The page header already shows a hadith's source as a badge (the reader, owner round 7, B4): the reference and the
   * source lines are not repeated here, and the grade line keeps only what the badge does not say.
   */
  sourceInHeader?: boolean;
  className?: string;
}

/**
 * Renders source provenance below Arabic quote text.
 * Different sub-sections per QuoteType; only non-null fields are shown.
 */
export function SourceAttribution({
  quote,
  labels,
  citationAnchorId,
  sourceInHeader = false,
  className,
}: SourceAttributionProps) {
  const arabic = useLocale() === 'ar';
  const locale = arabic ? 'ar' : 'en';
  const { type, source, quran, hadith, book, citation } = quote;
  const badgeShown = sourceInHeader && type === QuoteType.HADITH;
  const bookTitle = arabic ? visible(book?.bookTitle, true) : englishProvenance(book?.bookTitle);
  const bookAuthor = arabic ? visible(book?.author, true) : englishProvenance(book?.author);
  const pageOrChapter = visible(book?.pageOrChapter, arabic);
  const volume = visible(citation?.volume, arabic);
  const page = visible(citation?.page, arabic);
  const gradeLine = formatGradeCitation({
    locale,
    gradeAuthority: citation?.gradeAuthority,
    gradeReference: citation?.gradeReference,
    grade: hadith?.grade,
    besideSource: badgeShown ? hadith?.reference : null,
    collectorInBadge: badgeShown,
  });
  const sourceName = arabic ? source.nameAr : (source.name || source.nameAr);
  const sourceInArabic = Boolean(sourceName && /[\u0600-\u06FF]/.test(sourceName));
  const surahName = arabic ? quran?.surahNameAr : (quran?.surahName || quran?.surahNameAr);
  const narrator = arabic ? hadith?.narratorAr : (hadith?.narrator || hadith?.narratorAr);
  const hasPrintedLocation = Boolean(volume || page || gradeLine);

  return (
    <footer
      id={citationAnchorId}
      className={cn('flex flex-col gap-1 text-sm text-muted-foreground', className)}
    >
      {type === QuoteType.QURAN_VERSE && quran && (
        <span>
          {surahName && (
            <span dir={arabic ? 'rtl' : undefined} lang={arabic ? 'ar' : 'en'} className={arabic ? 'font-arabic-ui' : undefined}>
              {surahName}
            </span>
          )}
          {quran.surahNumber && quran.ayahNumber && (
            <>
              {/* «الحجرات · 49:11» (W-28): a separator, and the numbers isolated so they never stick to the name. */}
              {surahName ? <span aria-hidden> · </span> : null}
              {/* Deliberate dir="ltr": surah:ayah reads left to right in both locales. */}
              <bdi dir="ltr" className="tabular-nums">
                <FormattedNumber value={quran.surahNumber} />:<FormattedNumber value={quran.ayahNumber} />
              </bdi>
            </>
          )}
        </span>
      )}

      {type === QuoteType.HADITH && hadith && (
        <>
          {narrator && (
            <span>
              <span className="me-1 font-medium">{labels.narrator}:</span>
              <span dir={arabic ? 'rtl' : undefined} lang={arabic ? 'ar' : undefined} className={arabic ? 'font-arabic-ui' : undefined}>
                {arabic ? narrator : englishProvenance(narrator)}
              </span>
            </span>
          )}
          {(() => {
            const raw = hadith.reference?.trim();
            if (!raw || badgeShown) return null;
            if (arabic && /[A-Za-z]/.test(raw)) return null;
            const display = arabic ? raw : (englishProvenance(raw) ?? raw);
            return (
              <span>
                <span className="me-1 font-medium">{labels.reference}:</span>
                <FormattedNumber value={display} />
              </span>
            );
          })()}
        </>
      )}

      {(type === QuoteType.SCHOLAR_QUOTE || type === QuoteType.BOOK_EXCERPT) && (
        <>
          {bookTitle && (
            <span>
              <bdi>{bookTitle}</bdi>
              {bookAuthor && <bdi className="ms-1">— {bookAuthor}</bdi>}
            </span>
          )}
          {pageOrChapter && (
            <span>
              <FormattedNumber value={pageOrChapter} />
            </span>
          )}
        </>
      )}

      {hasPrintedLocation && (
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {volume && (
            <span>
              <span className="me-1 font-medium">{labels.volume}:</span>
              <FormattedNumber value={volume} />
            </span>
          )}
          {page && (
            <span>
              <span className="me-1 font-medium">{labels.page}:</span>
              <FormattedNumber value={page} />
            </span>
          )}
          {gradeLine ? (
            <>
              {(volume || page) ? <span aria-hidden="true">·</span> : null}
              <FormattedNumber value={gradeLine} />
            </>
          ) : null}
        </span>
      )}

      {sourceName && !badgeShown && !(arabic && /[A-Za-z]/.test(sourceName)) ? (
        <span className="mt-0.5">
          <span className="me-1 font-medium">{labels.source}:</span>
          <span dir={sourceInArabic ? 'rtl' : 'ltr'} lang={sourceInArabic ? 'ar' : 'en'} className={sourceInArabic ? 'font-arabic-ui' : undefined}>
            {sourceName}
          </span>
        </span>
      ) : null}
    </footer>
  );
}
