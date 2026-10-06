import { cn } from '@/lib/utils';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';

interface SourceAttributionProps {
  quote: Pick<QuoteDto, 'type' | 'source' | 'quran' | 'hadith' | 'book' | 'citation'>;
  /** Translated labels */
  labels: {
    narrator: string;
    reference: string;
    source: string;
    volume: string;
    page: string;
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
  const { type, source, quran, hadith, book, citation } = quote;
  const hasPrintedLocation = Boolean(citation?.volume || citation?.page);

  return (
    <footer
      id={citationAnchorId}
      className={cn('flex flex-col gap-1 text-sm text-muted-foreground', className)}
    >
      {type === QuoteType.QURAN_VERSE && quran && (
        <span>
          {quran.surahNameAr && (
            <span dir="rtl" lang="ar" className="font-arabic">
              {quran.surahNameAr}
            </span>
          )}
          {quran.surahNumber && quran.ayahNumber && (
            <bdi className="ms-1">
              {quran.surahNumber}:{quran.ayahNumber}
            </bdi>
          )}
        </span>
      )}

      {type === QuoteType.HADITH && hadith && (
        <>
          {hadith.narratorAr && (
            <span>
              <span className="me-1 font-medium">{labels.narrator}:</span>
              <span dir="rtl" lang="ar" className="font-arabic">
                {hadith.narratorAr}
              </span>
            </span>
          )}
          {hadith.reference && (
            <span>
              <span className="me-1 font-medium">{labels.reference}:</span>
              <bdi>{hadith.reference}</bdi>
            </span>
          )}
        </>
      )}

      {(type === QuoteType.SCHOLAR_QUOTE || type === QuoteType.BOOK_EXCERPT) && (
        <>
          {book?.bookTitle && (
            <span>
              <bdi>{book.bookTitle}</bdi>
              {book.author && <bdi className="ms-1">— {book.author}</bdi>}
            </span>
          )}
          {book?.pageOrChapter && (
            <span>
              <bdi>{book.pageOrChapter}</bdi>
            </span>
          )}
        </>
      )}

      {hasPrintedLocation && (
        <span>
          {citation?.volume && (
            <span>
              <span className="me-1 font-medium">{labels.volume}:</span>
              <bdi>{citation.volume}</bdi>
            </span>
          )}
          {citation?.page && (
            <span className={citation.volume ? 'ms-2' : undefined}>
              <span className="me-1 font-medium">{labels.page}:</span>
              <bdi>{citation.page}</bdi>
            </span>
          )}
        </span>
      )}

      <span className="mt-0.5">
        <span className="me-1 font-medium">{labels.source}:</span>
        {source.nameAr ? (
          <span dir="rtl" lang="ar" className="font-arabic">
            {source.nameAr}
          </span>
        ) : (
          <bdi>{source.name}</bdi>
        )}
      </span>
    </footer>
  );
}
