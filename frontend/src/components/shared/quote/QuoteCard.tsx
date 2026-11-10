'use client';

import { useEffect, useRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { BookOpen, Check, CheckCheck, MessageSquareQuote } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';
import type { QuoteDto, QuoteLinkDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import { englishProvenance } from '@/lib/format/provenance';
import { formatGradeCitation } from '@/lib/format/grade-citation';
import { GradeBadge } from './GradeBadge';
import { SourceBadge } from './SourceBadge';
import { QuoteBody } from './QuoteBody';
import { FavoriteButton } from './FavoriteButton';
import { QuoteMoreMenu } from './QuoteMoreMenu';
import { RecitationButton } from './RecitationButton';
import { Button } from '@/components/shared/kit/button';
import { ShareButton } from '../share/ShareButton';
import { useQuoteSharePayload } from '../share/useQuoteSharePayload';

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
  /** Saved state when the quote object does not carry it (public lists); defaults to `quote.isFavorite`. */
  isFavorite?: boolean;
  onToggleFavorite?: (quoteId: string, currentlyFavorited: boolean) => void;
  isFavoritePending?: boolean;
  /**
   * Opens the study panel (tafsir / sharh).
   * @deprecated Round 6 (C-12): a text card has ONE button, «عرض التفسير», which opens the reader (`detailHref`); the
   * study panel is no longer offered from a card. Kept so older callers compile; ignored.
   */
  onOpenStudy?: (quote: QuoteDto) => void;
  /** The topic↔text link, so the reader can show its «وجه التذكير» (`/quotes/<id>?linkId=`). */
  linkId?: string | null;
  /** «مقروء» / «غير مقروء» (round 6): shown when given (members). */
  read?: boolean;
  onToggleRead?: (read: boolean) => void;
  /**
   * Topic lists (W-24 b): the text is cut to 4 lines; when it is longer, the card's link reads «اقرأ كاملًا» and opens
   * the text page (the same link as «عرض كامل», never a second button to the same page).
   */
  clamp?: boolean;
  className?: string;
}

function visibleArabic(value: string | null | undefined, arabic: boolean): string | null {
  if (!value) return null;
  if (arabic && /[A-Za-z]/.test(value)) return null;
  return value;
}

export function QuoteCard({
  quote,
  link,
  linkId,
  read,
  onToggleRead,
  detailHref,
  density,
  intent,
  showFavoriteButton = false,
  isFavorite,
  onToggleFavorite,
  isFavoritePending = false,
  clamp = false,
  className,
}: QuoteCardProps) {
  const locale = useLocale();
  const arabic = locale === 'ar';
  const t = useTranslations('quote');
  const tFav = useTranslations('favorites');
  const bodyRef = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  // null until measured: the text starts clamped (no jump for long texts), then a text that fits in 4 lines drops the
  // clamp so its overflow is visible again: the clamp's `overflow: hidden` clipped the marks under the last line (the
  // kasra of «وَإِذْ», owner round 7, B7).
  const [fits, setFits] = useState<boolean | null>(null);

  // Is the 4-line cut hiding text? Measured after layout and on resize (fonts, width); false until then.
  useEffect(() => {
    if (!clamp) return;
    const node = bodyRef.current?.querySelector('blockquote');
    if (!node) return;
    // Diacritics and Quranic marks paint above and below the line box and add a few pixels of scroll height, so a
    // text counts as cut only when at least half a line is hidden. scrollHeight is the full text's height whether the
    // clamp is on or off, so the measure holds in both states.
    const measure = () => {
      const style = getComputedStyle(node);
      const line = Number.parseFloat(style.lineHeight) || 32;
      const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      const isCut = node.scrollHeight - padding - 4 * line > line / 2;
      setCut(isCut);
      setFits(!isCut);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [clamp]);

  const isAthar = Boolean(quote.isAthar);
  const { typeKey: rawTypeKey, Icon } = QUOTE_TYPE_CONFIG[quote.type];
  // Athar are companion/successor sayings stored as HADITH rows — never label them «حديث نبوي».
  const typeKey = isAthar ? 'athar' : rawTypeKey;
  const typeLabel = t(`type.${typeKey}`);
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const isHadith = quote.type === QuoteType.HADITH;
  const grade = quote.hadith?.grade;
  const isWeak =
    isHadith &&
    (grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU);

  // Round 6 (C-12): no «لماذا هذه الآية؟» panel on the card; the link's note and «وجه التذكير» live in the reader.
  void link;
  const showViewLink = Boolean(detailHref);
  const showFavorite = Boolean(
    showFavoriteButton && onToggleFavorite,
  );

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
  const hadithRefRaw = quote.hadith?.reference?.trim() || null;
  const gradeLine = formatGradeCitation({
    locale: arabic ? 'ar' : 'en',
    gradeAuthority: quote.citation?.gradeAuthority,
    gradeReference: quote.citation?.gradeReference,
    grade: quote.hadith?.grade,
    // The source badge already names the book and number: the line never repeats it (owner round 7, B4).
    besideSource: hadithRefRaw,
  });
  // Verses, hadith and athar (stored as hadith) are the shareable public texts.
  const shareable = isQuran || isHadith;
  const sharePayload = useQuoteSharePayload(quote);

  return (
      <article
        className={cn(quoteCardVariants({ density, intent }), className)}
        aria-labelledby={`quote-${quote.id}-text`}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {/* Row 1 (owner round 7, B3): the type and, beside it, the grade — the word only. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1',
                  'text-[13px] font-medium md:text-[14px]',
                  isAthar
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary-text',
                  arabic && 'font-arabic-ui',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {typeLabel}
              </span>
              {isHadith && grade && grade !== HadithGrade.UNGRADED && !quote.isAthar ? (
                <GradeBadge grade={grade} label={t(`grade.${grade.toLowerCase()}`)} />
              ) : null}
            </div>

            {/* A verse: «الأنعام | 6:121» only — «القرآن الكريم» adds nothing beside «آية قرآنية» (B8). */}
            {isQuran && quote.quran && (surahName || (quote.quran.surahNumber && quote.quran.ayahNumber)) ? (
              <span
                className={cn(
                  'inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full',
                  'border border-border/70 bg-background/80 px-2.5 py-1 text-[13px] text-foreground md:text-[14px]',
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
                    {/* Deliberate dir="ltr": «2:255» must read surah:ayah in both locales. */}
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
            ) : null}

            {isHadith ? (
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <SourceBadge quote={quote} />
                {narrator ? (
                  <p
                    dir={arabic ? 'rtl' : undefined}
                    lang={arabic ? 'ar' : undefined}
                    className={cn(
                      'text-[13px] text-muted-foreground md:text-[14px]',
                      arabic && 'font-arabic-ui',
                    )}
                  >
                    <span className="me-1">{t('narrator')}:</span>
                    {arabic ? narrator : (englishProvenance(narrator) ?? narrator)}
                  </p>
                ) : null}
                {gradeLine && !quote.isAthar ? (
                  <p className="text-xs text-muted-foreground">
                    <FormattedNumber value={gradeLine} />
                  </p>
                ) : null}
                {quote.citation?.alsoIn ? (
                  <p
                    dir={/[\u0600-\u06FF]/.test(quote.citation.alsoIn) ? 'rtl' : 'ltr'}
                    lang={/[\u0600-\u06FF]/.test(quote.citation.alsoIn) ? 'ar' : 'en'}
                    className={cn(
                      'text-xs text-muted-foreground',
                      arabic && 'font-arabic-ui',
                    )}
                  >
                    <FormattedNumber value={quote.citation.alsoIn} />
                  </p>
                ) : null}
                {quote.isAthar && quote.atharSpeakerAr && arabic ? (
                  <p
                    dir="rtl"
                    lang="ar"
                    className={cn(
                      'text-[13px] text-muted-foreground md:text-[14px]',
                      'font-arabic-ui',
                    )}
                  >
                    {quote.atharAttributionKind === 'NARRATED'
                      ? `رواه ${quote.atharSpeakerAr}`
                      : `— ${quote.atharSpeakerAr}`}
                  </p>
                ) : null}
                {quote.isAthar && quote.atharSpeakerAr && !arabic ? (
                  // English frame; the speaker has no English name yet, so the Arabic proper name
                  // stays isolated and marked inside the English line.
                  <p lang="en" className="text-[13px] text-muted-foreground md:text-[14px]">
                    {quote.atharAttributionKind === 'NARRATED' ? 'Narrated by ' : '— '}
                    <bdi lang="ar" dir="rtl" className="font-arabic-ui">
                      {quote.atharSpeakerAr}
                    </bdi>
                  </p>
                ) : null}
                {quote.isAthar ? (
                  <p
                    dir={arabic ? 'rtl' : 'ltr'}
                    lang={arabic ? 'ar' : 'en'}
                    className={cn(
                      'text-xs text-muted-foreground',
                      arabic && 'font-arabic-ui',
                    )}
                  >
                    {/* The reference is in the badge above: never a second time here (B4). */}
                    {arabic ? 'أثر، وليس حديثًا' : 'A saying, not a hadith'}
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

          {showFavorite || shareable ? (
            // Card actions, one 44px icon each: listen (verses), share, save, «⋯» (report, W-04).
            <div className="-me-2 -mt-1 flex shrink-0 items-center">
              {isQuran && quote.quran?.surahNumber && quote.quran.ayahNumber ? (
                <RecitationButton surah={quote.quran.surahNumber} ayah={quote.quran.ayahNumber} />
              ) : null}
              {shareable ? (
                <ShareButton
                  payload={sharePayload}
                  path={`/quotes/${quote.id}`}
                  fileName={`thekra-${quote.id}`}
                />
              ) : null}
              {showFavorite ? (
                <FavoriteButton
                  quoteId={quote.id}
                  isFavorite={isFavorite ?? quote.isFavorite ?? false}
                  isPending={isFavoritePending}
                  label={tFav('add')}
                  labelRemove={tFav('remove')}
                  onToggle={onToggleFavorite!}
                  className="size-11"
                />
              ) : null}
              {isHadith ? <QuoteMoreMenu quoteId={quote.id} /> : null}
            </div>
          ) : null}
        </header>

        <div ref={bodyRef} id={`quote-${quote.id}-text`} className="min-w-0 overflow-visible">
          <QuoteBody quote={quote} className={clamp && fits !== true ? 'line-clamp-4' : undefined} />
        </div>

        {/* ONE action (round 6, C-12): «عرض التفسير» (a verse) / «عرض الشرح» (a hadith) opens the reader, where the text,
            «وجه التذكير» and the explanations read inline; other texts «اقرأ كاملًا». Owner round 7 (B5): that action is the
            card's solid primary, and «تعليم كمقروء» sits beside it as a clear bordered button of the same size. */}
        {(showViewLink && detailHref) || onToggleRead ? (
          // text-sm font-medium on the row: the site's `button { font: inherit }` would otherwise give the read button a
          // larger face than the link beside it.
          <div className={cn('flex flex-wrap items-center gap-3 text-sm font-medium', arabic && 'font-arabic-ui')}>
            {showViewLink && detailHref ? (
              <Button asChild variant="solid" tone="primary" size="md" className="min-w-0 flex-1 sm:flex-none">
                <Link href={linkId ? `${detailHref}?linkId=${encodeURIComponent(linkId)}` : detailHref}>
                  {isQuran ? t('openReaderTafsir') : isHadith && !isAthar ? t('openReaderSharh') : cut ? t('readFull') : t('viewFull')}
                  <DirectionalArrow className="size-3.5" />
                </Link>
              </Button>
            ) : null}
            {onToggleRead ? (
              <Button
                type="button"
                variant="outline"
                tone="primary"
                size="md"
                aria-pressed={Boolean(read)}
                onClick={() => onToggleRead(!read)}
                icon={read ? <CheckCheck aria-hidden /> : <Check aria-hidden />}
                className={cn(
                  'min-w-0 flex-1 sm:flex-none',
                  // Read: the same border, a soft fill, so the state reads at a glance without a second solid button.
                  read && 'bg-primary/10',
                )}
              >
                {read ? t('read') : t('markRead')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </article>
  );
}
