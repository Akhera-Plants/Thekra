/** UTC day count. Matches the API's choice of today's reminder. */
export function utcDayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export function reminderWord(count: number, locale: string = 'ar'): string {
  if (locale !== 'ar') return count === 1 ? 'reminder' : 'reminders';
  if (count === 1) return 'تذكرة';
  if (count === 2) return 'تذكرتان';
  if (count >= 3 && count <= 10) return 'تذكرات';
  return 'تذكرة';
}
