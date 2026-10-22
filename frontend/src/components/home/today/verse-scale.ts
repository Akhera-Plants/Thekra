/**
 * Home featured card. A short line stays the large verse.
 * A long passage steps down and is clamped in CSS so the card
 * stays beside the deed of the day. The full text is one link away.
 */
export function featuredVerseScale(length: number): '' | 'is-medium' | 'is-long' {
  if (length > 280) return 'is-long';
  if (length > 140) return 'is-medium';
  return '';
}
