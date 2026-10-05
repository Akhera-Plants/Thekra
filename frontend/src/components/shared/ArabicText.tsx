import { cn } from '@/lib/utils';

interface ArabicTextProps {
  children: React.ReactNode;
  as?: 'p' | 'span' | 'div' | 'blockquote' | 'h1' | 'h2' | 'h3';
  /** Defaults to 'lg' (18px min per plan §7.3). Use 'xl' for verse/hadith bodies. */
  size?: 'sm' | 'base' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg md:text-xl',
  xl: 'text-xl md:text-2xl',
} as const;

/**
 * Renders Arabic content (`textAr`, verses, hadith) with:
 *  - `dir="rtl"` pinned to the element (never relies on parent dir)
 *  - `font-arabic` from `--font-arabic` CSS variable
 *  - `leading-loose` for diacritics vertical space (plan §4.3)
 *  - never `text-justify` (degrades Arabic shaping)
 */
export function ArabicText({
  children,
  as: Tag = 'p',
  size = 'lg',
  className,
}: ArabicTextProps) {
  return (
    <Tag
      dir="rtl"
      lang="ar"
      className={cn(
        'font-arabic leading-loose',
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
