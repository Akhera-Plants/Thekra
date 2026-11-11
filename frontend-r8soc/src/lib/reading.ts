/**
 * Texts per page on a topic reader: the first (server) page and every «show more». Small enough
 * for a fast first paint, large enough that most themes fit on one page.
 */
export const TOPIC_PAGE_SIZE = 20;

export interface ReadingPiece {
  id: string;
}

/** Reader mode: a warning, then its reward, then the next warning. */
export function interleaveReading<T extends ReadingPiece>(warning: T[], reward: T[]): T[] {
  const count = Math.max(warning.length, reward.length);
  const items: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const left = warning[index];
    const right = reward[index];
    if (left) items.push(left);
    if (right) items.push(right);
  }
  return items;
}
