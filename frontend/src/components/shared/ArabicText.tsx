import { cn } from '@/lib/utils';

interface ArabicTextProps {
  children: React.ReactNode;
  as?: 'p' | 'span' | 'div' | 'blockquote' | 'h1' | 'h2' | 'h3';
  /** Defaults to 'lg' (18px min per plan §7.3). Use 'xl' for verse/hadith bodies. */
  size?: 'sm' | 'base' | 'lg' | 'xl';
  /**
   * Which Thmanyah face. Headings default to display; everything else to the
   * reading (text) face. `ui` is the sans face for short labels.
   */
  face?: 'text' | 'display' | 'ui';
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg md:text-xl',
  xl: 'text-xl md:text-2xl',
} as const;

const faceClasses = {
  text: 'font-arabic-text leading-loose',
  display: 'font-arabic-display leading-relaxed',
  ui: 'font-arabic-ui leading-normal',
} as const;

/**
 * Renders Arabic content (`textAr`, verses, hadith) with:
 *  - `dir="rtl"` pinned to the element (never relies on parent dir)
 *  - a Thmanyah face (display / text / ui)
 *  - loose leading on reading text (plan §4.3)
 *  - never `text-justify` (degrades Arabic shaping)
 */
export function ArabicText({
  children,
  as: Tag = 'p',
  size = 'lg',
  face,
  className,
}: ArabicTextProps) {
  const resolvedFace = face ?? (Tag === 'h1' || Tag === 'h2' ? 'display' : 'text');

  return (
    <Tag
      dir="rtl"
      lang="ar"
      className={cn(
        faceClasses[resolvedFace],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
