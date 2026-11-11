/**
 * English UI never falls back to the Arabic branch title.
 * Until `title` is filled, show «Branch N».
 */
export function branchLabel(
  locale: string,
  branch: { number: number; title?: string | null; titleAr?: string | null },
  branchWord = 'Branch',
): string {
  if (locale === 'ar') return branch.titleAr ?? '';
  if (branch.title?.trim()) return branch.title.trim();
  return `${branchWord} ${branch.number}`;
}
