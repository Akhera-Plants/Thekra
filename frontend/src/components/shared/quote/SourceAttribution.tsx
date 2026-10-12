'use client';

import { useLocale } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';

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
  className,
}: SourceAttributionProps) {
  const arabic = useLocale() === 'ar';
  const { type, source, quran, hadith, book, citation } = quote;
  const bookTitle = visible(book?.bookTitle, arabic);
  const bookAuthor = visible(book?.author, arabic);
  const pageOrChapter = visible(book?.pageOrChapter, arabic);
  const gradeAuthority = visible(citation?.gradeAuthority, arabic);
  const gradeReference = visible(citation?.gradeReference, arabic);
  const volume = visible(citation?.volume, arabic);
  const page = visible(citation?.page, arabic);
  const sourceName = arabic ? source.nameAr : (source.nameAr ?? source.name);
  const sourceNameLatin = sourceName && arabic && /[A-Za-z]/.test(sourceName) ? null : sourceName;
  const hasPrintedLocation = Boolean(volume || page || gradeAuthority || gradeReference);

  return (
    <footer
      id={citationAnchorId}
      className={cn('flex flex-col gap-1 text-sm text-muted-foreground', className)}
    >
      {type === QuoteType.QURAN_VERSE && quran && (
        <span>
          {quran.surahNameAr && (
            <span dir="rtl" lang="ar" className="font-arabic-ui">
              {quran.surahNameAr}
            </span>
          )}
          {quran.surahNumber && quran.ayahNumber && (
            <bdi className="ms-1">
              <FormattedNumber value={quran.surahNumber} />
              :
              <FormattedNumber value={quran.ayahNumber} />
            </bdi>
          )}
        </span>
      )}

      {type === QuoteType.HADITH && hadith && (
        <>
          {hadith.narratorAr && (
            <span>
              <span className="me-1 font-medium">{labels.narrator}:</span>
              <span dir="rtl" lang="ar" className="font-arabic-ui">
                {hadith.narratorAr}
              </span>
            </span>
          )}
          {visible(hadith.reference, arabic) && (
            <span>
              <span className="me-1 font-medium">{labels.reference}:</span>
              <FormattedNumber value={hadith.reference ?? ''} />
            </span>
          )}
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
        <span>
          {volume && (
            <span>
              <span className="me-1 font-medium">{labels.volume}:</span>
              <FormattedNumber value={volume} />
            </span>
          )}
          {page && (
            <span className={volume ? 'ms-2' : undefined}>
              <span className="me-1 font-medium">{labels.page}:</span>
              <FormattedNumber value={page} />
            </span>
          )}
          {gradeAuthority && (
            <span className="ms-2">
              <span className="me-1 font-medium">{labels.gradeAuthority}:</span>
              <bdi>{gradeAuthority}</bdi>
            </span>
          )}
          {gradeReference && (
            <span className="ms-2">
              <span className="me-1 font-medium">{labels.gradeReference}:</span>
              <FormattedNumber value={gradeReference} />
            </span>
          )}
        </span>
      )}

      {sourceNameLatin ? (
        <span className="mt-0.5">
          <span className="me-1 font-medium">{labels.source}:</span>
          <span dir={arabic || source.nameAr ? 'rtl' : undefined} lang={arabic || source.nameAr ? 'ar' : undefined} className="font-arabic-ui">
            {sourceNameLatin}
          </span>
        </span>
      ) : null}
    </footer>
  );
}
