'use client';

import { type VariantProps, cva } from 'class-variance-authority';
import {
  BookMarked,
  BookOpen,
  Quote,
  ScrollText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { QuoteDto, QuoteLinkDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import { ArabicText } from '../ArabicText';
import { GradeBadge } from './GradeBadge';
import { SourceAttribution } from './SourceAttribution';
import { FavoriteButton } from './FavoriteButton';

// ── Config map (one place for per-type logic) ─────────────────────────────────
interface QuoteTypeConfig {
  icon: React.ComponentType<{ className?: string; 'aria-hidden': boolean }>;
  typeKey: string; // key in quote.type.* namespace
  cardVariant: 'verse' | 'hadith' | 'scholar' | 'book';
}

const QUOTE_TYPE_CONFIG = {
  [QuoteType.QURAN_VERSE]: {
    icon: BookOpen,
    typeKey: 'quran',
    cardVariant: 'verse',
  },
  [QuoteType.HADITH]: {
    icon: ScrollText,
    typeKey: 'hadith',
    cardVariant: 'hadith',
  },
  [QuoteType.SCHOLAR_QUOTE]: {
    icon: Quote,
    typeKey: 'scholar',
    cardVariant: 'scholar',
  },
  [QuoteType.BOOK_EXCERPT]: {
    icon: BookMarked,
    typeKey: 'book',
    cardVariant: 'book',
  },
} satisfies Record<QuoteType, QuoteTypeConfig>;

// ── CVA variants ─────────────────────────────────────────────────────────────
const quoteCardVariants = cva(
  'group flex flex-col gap-3 rounded-lg border border-border bg-card text-card-foreground shadow-xs transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
  {
    variants: {
      kind: {
        verse: 'border-s-2 border-s-primary',
        hadith: '',
        scholar: '',
        book: '',
      },
      density: {
        compact: 'p-4',
        full: 'p-5 md:p-6',
      },
    },
    defaultVariants: {
      density: 'full',
    },
  },
);

// ── Props ─────────────────────────────────────────────────────────────────────
export interface QuoteCardProps extends VariantProps<typeof quoteCardVariants> {
  quote: QuoteDto;
  link?: Pick<QuoteLinkDto, 'relevanceScore' | 'note'> | null;
  /** If provided, wraps the card in a link to the full quote detail. */
  detailHref?: string;
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
  showFavoriteButton = false,
  onToggleFavorite,
  isFavoritePending = false,
  className,
}: QuoteCardProps) {
  const t = useTranslations('quote');
  const tFav = useTranslations('favorites');
  const config = QUOTE_TYPE_CONFIG[quote.type];
  const { icon: TypeIcon, typeKey, cardVariant } = config;
  const typeLabel = t(`type.${typeKey}`);

  const isHadith = quote.type === QuoteType.HADITH;
  const grade = quote.hadith?.grade;
  const isWeak =
    isHadith &&
    (grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU);

  const cardContent = (
    <article
      className={cn(quoteCardVariants({ kind: cardVariant, density }), className)}
      aria-labelledby={`quote-${quote.id}-text`}
    >
      {/* Header row: type icon + badge + grade + optional favorite */}
      <header className="flex flex-wrap items-center gap-2">
        <TypeIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">
          {typeLabel}
        </span>
        {isHadith && grade && grade !== HadithGrade.UNGRADED && (
          <GradeBadge
            grade={grade}
            label={t(`grade.${grade.toLowerCase()}`)}
          />
        )}
        {link?.note && (
          <span className="ms-auto text-xs text-muted-foreground">
            {link.note}
          </span>
        )}
        {/* Favorite button — shown only when feature layer provides the handler */}
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
      </header>

      {/* Weak hadith notice */}
      {isWeak && (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          {t('weakNotice')}
        </p>
      )}

      {/* Arabic text — always shown, never replaced */}
      <div id={`quote-${quote.id}-text`}>
        <ArabicText as="blockquote" size="xl" className="border-none ps-0">
          {quote.textAr}
        </ArabicText>
      </div>

      {/* Translation — shown below Arabic, never instead of it */}
      {quote.translation && (
        <p className="text-sm text-muted-foreground">
          {quote.translation.text}
        </p>
      )}

      {/* Source provenance */}
      <SourceAttribution
        quote={quote}
        labels={{
          narrator: t('narrator'),
          reference: t('reference'),
          source: t('source'),
          volume: t('volume'),
          page: t('page'),
        }}
      />

      {/* "View full" link */}
      {detailHref && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground underline-offset-2 group-hover:underline">
            {t('viewFull')}
          </span>
        </div>
      )}
    </article>
  );

  if (detailHref) {
    return (
      <Link
        href={detailHref}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
