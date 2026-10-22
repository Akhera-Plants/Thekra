/** Arabic script outside lang="ar" on English pages. */
const ARABIC = /[\u0600-\u06FF]/;

export function arabicLeaks(text: string): string[] {
  const leaks: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (ARABIC.test(trimmed)) leaks.push(trimmed);
  }
  return leaks;
}
