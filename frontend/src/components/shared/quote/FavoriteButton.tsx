/**
 * FavoriteButton — presentational button for the shared quote layer.
 *
 * Receives all state and callbacks as props; never fetches data itself.
 * The feature layer (features/favorites/hooks/useToggleFavorite) wires
 * the mutation and passes the result down via QuoteCard's props.
 */
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FavoriteButtonProps {
  quoteId: string;
  isFavorite: boolean;
  isPending?: boolean;
  /** Accessible label when not favorited, e.g. "أضف إلى المفضلة" */
  label: string;
  /** Accessible label when already favorited, e.g. "إزالة من المفضلة" */
  labelRemove: string;
  onToggle: (quoteId: string, currentlyFavorited: boolean) => void;
  className?: string;
}

export function FavoriteButton({
  quoteId,
  isFavorite,
  isPending = false,
  label,
  labelRemove,
  onToggle,
  className,
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? labelRemove : label}
      disabled={isPending}
      onClick={(e) => {
        // Prevent the parent Link (detailHref wrapper) from navigating
        e.preventDefault();
        e.stopPropagation();
        onToggle(quoteId, isFavorite);
      }}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground',
        'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:scale-[0.92] motion-reduce:active:scale-100',
        className,
      )}
    >
      <Heart
        className={cn(
          'size-4 transition-colors duration-150',
          isFavorite && 'motion-safe:animate-heart-beat fill-current text-destructive',
        )}
        aria-hidden
      />
    </button>
  );
}
