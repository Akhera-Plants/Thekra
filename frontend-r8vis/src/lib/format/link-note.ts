import { englishLinkNote } from '@/lib/format/provenance';

/**
 * Public attribution notes only (CHAPTER_AYAH / author citation).
 * Curator relevance/editorial notes never reach the reader.
 */
export function publicLinkNote(
  note: string | null | undefined,
  locale: 'ar' | 'en',
): string | null {
  if (!note) return null;
  const text = note.replace(/\s+/g, ' ').trim();
  const attributed =
    /^أورده\s+/.test(text)
    || /^ذكره\s+/.test(text)
    || /^(?:من باب|تصنيف المراجع حسب موضوع الباب|اقتراح من عنوان الباب)\s*:/.test(text)
    || /^من كتاب\s+/.test(text);
  if (!attributed) return null;
  if (locale === 'en') return englishLinkNote(text);
  return text;
}
