'use client';

import { useId, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Info,
  MessageSquareQuote,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';
import type { QuoteDto, QuoteLinkDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import { publicLinkNote } from '@/lib/format/link-note';
import { englishProvenance } from '@/lib/format/provenance';
import { formatGradeCitation } from '@/lib/format/grade-citation';
import { GradeBadge } from './GradeBadge';
import { QuoteBody } from './QuoteBody';
import { FavoriteButton } from './FavoriteButton';
import { ReportMistake } from './ReportMistake';

/** Which path/flow this card is being viewed in — reserved for list accent if needed. */
export type QuoteCardIntent = 'sin' | 'good-deed' | 'iman-branch';

const QUOTE_TYPE_CONFIG = {
  [QuoteType.QURAN_VERSE]: { typeKey: 'quran', Icon: BookOpen },
  [QuoteType.HADITH]: { typeKey: 'hadith', Icon: MessageSquareQuote },
  [QuoteType.SCHOLAR_QUOTE]: { typeKey: 'scholar', Icon: BookOpen },
  [QuoteType.BOOK_EXCERPT]: { typeKey: 'book', Icon: BookOpen },
} satisfies Record<
  QuoteType,
  { typeKey: string; Icon: typeof BookOpen }
>;

const quoteCardVariants = cva(
  [
    'group/card flex flex-col rounded-[1.35rem] border border-border/80 bg-card text-card-foreground',
    'shadow-[0_1px_2px_oklch(0.18_0.007_255_/_0.04)]',
    'motion-safe:transition-[box-shadow,border-color] motion-safe:duration-200',
    'motion-safe:hover:border-border motion-safe:hover:shadow-[0_2px_8px_oklch(0.18_0.007_255_/_0.06)]',
  ].join(' '),
  {
    variants: {
      kind: {
        verse: '',
        hadith: '',
        scholar: '',
        book: '',
      },
      density: {
        compact: 'gap-4 px-4 py-4 md:gap-5 md:px-5 md:py-5',
        full: 'gap-5 px-5 py-5 md:gap-6 md:px-7 md:py-7',
      },
      intent: {
        sin: '',
        'good-deed': '',
        'iman-branch': '',
      },
    },
    defaultVariants: {
      density: 'full',
    },
  },
);

export interface QuoteCardProps extends VariantProps<typeof quoteCardVariants> {
  quote: QuoteDto;
  link?: Pick<QuoteLinkDto, 'relevanceScore' | 'note'> | null;
  /** Full-quote destination; rendered as the context “view full” link, not a card wrapper. */
  detailHref?: string;
  intent?: QuoteCardIntent;
  showFavoriteButton?: boolean;
  onToggleFavorite?: (quoteId: string, currentlyFavorited: boolean) => void;
  isFavoritePending?: boolean;
  className?: string;
}

function visibleArabic(value: string | null | undefined, arabic: boolean): string | null {
  if (!value) return null;
  if (arabic && /[A-Za-z]/.test(value)) return null;
  return value;
}

function ContextLink({
  href,
  label,
  arabic,
  muted,
}: {
  href: string;
  label: string;
  arabic: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 w-fit items-center gap-1.5 self-start',
        'text-sm underline-offset-4 hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        muted
          ? 'text-muted-foreground hover:text-foreground'
          : 'text-primary',
        arabic && 'font-arabic-ui',
      )}
    >
      {label}
      <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}

export function QuoteCard({
  quote,
  link,
  detailHref,
  density,
  intent,
  showFavoriteButton = false,
  onToggleFavorite,
  isFavoritePending = false,
  className,
}: QuoteCardProps) {
  const locale = useLocale();
  const arabic = locale === 'ar';
  const t = useTranslations('quote');
  const tFav = useTranslations('favorites');
  const panelId = useId();
  const [contextOpen, setContextOpen] = useState(false);

  const { typeKey, Icon } = QUOTE_TYPE_CONFIG[quote.type];
  const typeLabel = t(`type.${typeKey}`);
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const isHadith = quote.type === QuoteType.HADITH;
  const grade = quote.hadith?.grade;
  const isWeak =
    isHadith &&
    (grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU);

  const note = publicLinkNote(link?.note, arabic ? 'ar' : 'en');
  const hasDisclosure = Boolean(note);
  const showViewLink = Boolean(detailHref);
  const showFavorite = Boolean(showFavoriteButton && onToggleFavorite);

  const surahName = arabic
    ? quote.quran?.surahNameAr
    : (quote.quran?.surahName || quote.quran?.surahNameAr);
  const narrator = arabic
    ? quote.hadith?.narratorAr
    : (quote.hadith?.narrator || quote.hadith?.narratorAr);
  const sourceName = arabic
    ? quote.source.nameAr
    : (quote.source.name || quote.source.nameAr);
  const quietSource =
    sourceName && !(arabic && /[A-Za-z]/.test(sourceName)) ? sourceName : null;
  const sourceDir = quietSource && /[\u0600-\u06FF]/.test(quietSource) ? 'rtl' : 'ltr';
  const sourceLang = sourceDir === 'rtl' ? 'ar' : 'en';
  const hadithRefRaw = quote.hadith?.reference?.trim() || null;
  const hadithRef =
    hadithRefRaw && !(arabic && /[A-Za-z]/.test(hadithRefRaw))
      ? (arabic ? hadithRefRaw : (englishProvenance(hadithRefRaw) ?? hadithRefRaw))
      : null;
  const gradeLine = formatGradeCitation({
    locale: arabic ? 'ar' : 'en',
    gradeAuthority: quote.citation?.gradeAuthority,
    gradeReference: quote.citation?.gradeReference,
    grade: quote.hadith?.grade,
  });
  const volume = visibleArabic(quote.citation?.volume, arabic);
  const page = visibleArabic(quote.citation?.page, arabic);
  const pageOrChapter = visibleArabic(quote.book?.pageOrChapter, arabic);
  const whyLabel = isQuran ? t('whyVerse') : t('whyHadith');

  return (
    <div className="flex flex-col gap-2">
      <article
        className={cn(quoteCardVariants({ density, intent }), className)}
        aria-labelledby={`quote-${quote.id}-text`}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <span
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1',
                'bg-primary/10 text-xs font-medium text-primary',
                arabic && 'font-arabic-ui',
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {typeLabel}
            </span>

            {isQuran && quote.quran ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {(surahName || (quote.quran.surahNumber && quote.quran.ayahNumber)) && (
                  <span
                    className={cn(
                      'inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full',
                      'border border-border/70 bg-background/80 px-2.5 py-1 text-sm text-foreground',
                      arabic && 'font-arabic-ui',
                    )}
                  >
                    {surahName ? (
                      <span
                        dir={arabic ? 'rtl' : undefined}
                        lang={arabic ? 'ar' : 'en'}
                        className="min-w-0 truncate"
                      >
                        {surahName}
                      </span>
                    ) : null}
                    {quote.quran.surahNumber && quote.quran.ayahNumber ? (
                      <>
                        <span
                          aria-hidden
                          className="h-3 w-px shrink-0 bg-border"
                        />
                        <bdi
                          dir="ltr"
                          className="tabular-nums text-muted-foreground"
                        >
                          <FormattedNumber value={quote.quran.surahNumber} />
                          :
                          <FormattedNumber value={quote.quran.ayahNumber} />
                        </bdi>
                      </>
                    ) : null}
                  </span>
                )}
                {quietSource ? (
                  <span
                    dir={sourceDir}
                    lang={sourceLang}
                    className={cn(
                      'text-xs text-muted-foreground',
                      sourceDir === 'rtl' && 'font-arabic-ui',
                    )}
                  >
                    {quietSource}
                  </span>
                ) : null}
              </div>
            ) : null}

            {isHadith ? (
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                  {(() => {
                    const refAlreadyNamesSource =
                      Boolean(quietSource && hadithRef && hadithRef.includes(quietSource));
                    const showSourceInCapsule = Boolean(quietSource && !refAlreadyNamesSource);
                    if (!showSourceInCapsule && !hadithRef) return null;
                    return (
                      <span
                        className={cn(
                          'inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full',
                          'border border-border/70 bg-background/80 px-2.5 py-1 text-sm text-foreground',
                          arabic && 'font-arabic-ui',
                        )}
                      >
                        {showSourceInCapsule ? (
                          <span
                            dir={sourceDir}
                            lang={sourceLang}
                            className="min-w-0 truncate"
                          >
                            {quietSource}
                          </span>
                        ) : null}
                        {showSourceInCapsule && hadithRef ? (
                          <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
                        ) : null}
                        {hadithRef ? (
                          <FormattedNumber
                            value={hadithRef}
                            className={cn(
                              'min-w-0',
                              showSourceInCapsule
                                ? 'tabular-nums text-muted-foreground'
                                : undefined,
                            )}
                          />
                        ) : null}
                      </span>
                    );
                  })()}
                  {grade && grade !== HadithGrade.UNGRADED ? (
                    <GradeBadge grade={grade} label={t(`grade.${grade.toLowerCase()}`)} />
                  ) : null}
                </div>
                {narrator ? (
                  <p
                    dir={arabic ? 'rtl' : undefined}
                    lang={arabic ? 'ar' : undefined}
                    className={cn(
                      'text-xs text-muted-foreground',
                      arabic && 'font-arabic-ui',
                    )}
                  >
                    <span className="me-1">{t('narrator')}:</span>
                    {arabic ? narrator : (englishProvenance(narrator) ?? narrator)}
                  </p>
                ) : null}
                {!hasDisclosure && gradeLine ? (
                  <p className="text-xs text-muted-foreground">
                    <FormattedNumber value={gradeLine} />
                  </p>
                ) : null}
                {isWeak ? (
                  <p role="note" className="text-xs text-muted-foreground">
                    {t('weakNotice')}
                  </p>
                ) : null}
                {quote.hadith?.outsideSahihayn ? (
                  <p role="note" className="text-xs text-muted-foreground">
                    {t('outsideSahihayn')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!isQuran && !isHadith ? (
              <p className="text-xs text-muted-foreground">
                {quietSource
                  ?? visibleArabic(quote.book?.bookTitle, arabic)
                  ?? typeLabel}
              </p>
            ) : null}
          </div>

          {showFavorite ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <FavoriteButton
                quoteId={quote.id}
                isFavorite={quote.isFavorite ?? false}
                isPending={isFavoritePending}
                label={tFav('add')}
                labelRemove={tFav('remove')}
                onToggle={onToggleFavorite!}
                className="size-11"
              />
            </div>
          ) : null}
        </header>

        <div id={`quote-${quote.id}-text`} className="min-w-0 overflow-visible">
          <QuoteBody quote={quote} />
        </div>

        {hasDisclosure ? (
          <div
            className={cn(
              'overflow-hidden rounded-2xl bg-primary/[0.06]',
              'ring-1 ring-primary/10',
            )}
          >
            <button
              type="button"
              className={cn(
                'flex w-full min-h-11 items-center gap-2 px-3.5 py-2.5 text-start',
                'text-sm text-foreground/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                arabic && 'font-arabic-ui',
              )}
              aria-expanded={contextOpen}
              aria-controls={panelId}
              onClick={() => setContextOpen((open) => !open)}
            >
              <Info className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">{whyLabel}</span>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200',
                  contextOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            <div
              id={panelId}
              role="region"
              aria-label={whyLabel}
              hidden={!contextOpen}
              className={cn(
                contextOpen
                  ? 'border-t border-primary/10'
                  : 'hidden',
              )}
            >
              {contextOpen ? (
                <div className="flex flex-col gap-3 px-3.5 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                  {note ? (
                    <p
                      dir={arabic ? 'rtl' : undefined}
                      lang={arabic ? 'ar' : 'en'}
                      className={cn(
                        'text-sm leading-relaxed text-muted-foreground',
                        arabic && 'font-arabic-ui',
                      )}
                    >
                      {note}
                    </p>
                  ) : null}

                  {(gradeLine || volume || page || pageOrChapter) && (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {gradeLine ? <FormattedNumber value={gradeLine} /> : null}
                      {volume ? (
                        <span>
                          <span className="me-1">{t('volume')}:</span>
                          <FormattedNumber value={volume} />
                        </span>
                      ) : null}
                      {page ? (
                        <span>
                          <span className="me-1">{t('page')}:</span>
                          <FormattedNumber value={page} />
                        </span>
                      ) : null}
                      {pageOrChapter ? (
                        <span className="inline-flex rounded-full bg-background/70 px-2 py-0.5 ring-1 ring-border/60">
                          <FormattedNumber value={pageOrChapter} />
                        </span>
                      ) : null}
                    </div>
                  )}

                  {showViewLink && detailHref ? (
                    <ContextLink
                      href={detailHref}
                      label={t('viewContext')}
                      arabic={arabic}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : showViewLink && detailHref ? (
          <ContextLink
            href={detailHref}
            label={t('viewFull')}
            arabic={arabic}
            muted
          />
        ) : null}
      </article>

      {isHadith ? <ReportMistake quoteId={quote.id} /> : null}
    </div>
  );
}
