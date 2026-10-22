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
