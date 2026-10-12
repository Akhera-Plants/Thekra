'use client';

import { type VariantProps, cva } from 'class-variance-authority';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { QuoteDto, QuoteLinkDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import { ArabicText } from '../ArabicText';
import { GradeBadge } from './GradeBadge';
import { SourceAttribution } from './SourceAttribution';
import { FavoriteButton } from './FavoriteButton';
import { ReportMistake } from './ReportMistake';

/** Which path/flow this card is being viewed in — drives the top accent + corner motif colour. */
export type QuoteCardIntent = 'sin' | 'good-deed' | 'iman-branch';

// One config map for the corner motif's colour per path (design-system.mdc §5.1) — tokens only.
const QUOTE_TYPE_CONFIG = {
  [QuoteType.QURAN_VERSE]: { typeKey: 'quran' },
  [QuoteType.HADITH]: { typeKey: 'hadith' },
  [QuoteType.SCHOLAR_QUOTE]: { typeKey: 'scholar' },
  [QuoteType.BOOK_EXCERPT]: { typeKey: 'book' },
} satisfies Record<QuoteType, { typeKey: string }>;

const quoteCardVariants = cva('group flex flex-col gap-4 border-b border-border py-6', {
  variants: {
    kind: {
      verse: '',
      hadith: '',
      scholar: '',
      book: '',
    },
    density: {
      compact: 'py-4',
      full: 'py-6',
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
});

// ── Props ─────────────────────────────────────────────────────────────────────
export interface QuoteCardProps extends VariantProps<typeof quoteCardVariants> {
  quote: QuoteDto;
  link?: Pick<QuoteLinkDto, 'relevanceScore' | 'note'> | null;
  /** If provided, wraps the card in a link to the full quote detail. */
  detailHref?: string;
  /**
   * Which path this card is being viewed in (sin / good-deed / iman-branch) — colours the top
   * accent border and the corner motif. Omit in neutral browse contexts (no accent, plain border).
   */
  intent?: QuoteCardIntent;
  /**
   * When true, renders a FavoriteButton in the card header.
   * Requires onToggleFavorite to be provided.
   */
  showFavoriteButton?: boolean;
  /** Called when the user taps the favorite button (auth-gated by caller). */
  onToggleFavorite?: (quoteId: string, currentlyFavorited: boolean) => void;
  isFavoritePending?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
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
  const t = useTranslations('quote');
  const tFav = useTranslations('favorites');
  const { typeKey } = QUOTE_TYPE_CONFIG[quote.type];
  const typeLabel = t(`type.${typeKey}`);

  const isHadith = quote.type === QuoteType.HADITH;
  const grade = quote.hadith?.grade;
  const isWeak =
    isHadith &&
    (grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU);

  const cardContent = (
    <article
      className={cn(quoteCardVariants({ density, intent }), className)}
      aria-labelledby={`quote-${quote.id}-text`}
    >
      <div id={`quote-${quote.id}-text`}>
        <ArabicText as="blockquote" size="xl" face="display" className="border-none ps-0">
          {quote.textAr}
        </ArabicText>
      </div>

      {quote.translation && locale === 'en' && (
        <p className="text-sm text-muted-foreground">{quote.translation.text}</p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{typeLabel}</span>
          {isHadith && grade && grade !== HadithGrade.UNGRADED && (
            <GradeBadge grade={grade} label={t(`grade.${grade.toLowerCase()}`)} />
          )}
          {showFavoriteButton && onToggleFavorite && (
            <span className="ms-auto">
              <FavoriteButton
                quoteId={quote.id}
                isFavorite={quote.isFavorite ?? false}
                isPending={isFavoritePending}
                label={tFav('add')}
                labelRemove={tFav('remove')}
                onToggle={onToggleFavorite}
              />
            </span>
          )}
        </div>
        {isWeak && <p role="note">{t('weakNotice')}</p>}
        <SourceAttribution
          quote={quote}
          labels={{
            narrator: t('narrator'),
            reference: t('reference'),
            source: t('source'),
            volume: t('volume'),
            page: t('page'),
            gradeAuthority: t('gradeAuthority'),
            gradeReference: t('gradeReference'),
          }}
        />
        {link?.note && quote.type === 'QURAN_VERSE' && (locale === 'en' || !/[A-Za-z]/.test(link.note)) && (
          <p className="text-sm text-muted-foreground">{t('whyVerse')}</p>
        )}
        {link?.note && (locale === 'en' || !/[A-Za-z]/.test(link.note)) && (
          <p className="leading-relaxed">{link.note}</p>
        )}
        {detailHref && (
          <span className="text-muted-foreground underline-offset-2 group-hover:underline">
            {t('viewFull')}
          </span>
        )}
      </div>
    </article>
  );

  const report = isHadith ? <ReportMistake quoteId={quote.id} /> : null;

  if (detailHref) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={detailHref}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          {cardContent}
        </Link>
        {report}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cardContent}
      {report}
    </div>
  );
}
