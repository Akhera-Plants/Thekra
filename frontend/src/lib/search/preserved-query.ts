import { parseThemeParam } from '@/lib/search/topic-themes';

const MAX_QUERY = 100;

/**
 * The part of the address bar that survives a language switch (audit B09):
 * the theme chip of a topic page and the search of a catalogue. Only these
 * two, validated; any other parameter is dropped. Returns "" or "?…".
 */
export function preservedQuery(search: string): string {
  const current = new URLSearchParams(search);
  const kept = new URLSearchParams();
  const theme = parseThemeParam(current.get('theme'));
  if (theme) kept.set('theme', theme);
  const q = current.get('q')?.trim();
  if (q && q.length <= MAX_QUERY) kept.set('q', q);
  const text = kept.toString();
  return text ? `?${text}` : '';
}
