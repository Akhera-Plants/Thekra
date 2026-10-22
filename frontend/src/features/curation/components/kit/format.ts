import { formatDigits } from '@/lib/format/digits';

/** Grouped count through the project's digit helper (tabular figures are applied by the caller). */
export function formatCount(value: number): string {
  return formatDigits(value.toLocaleString('en-US'));
}

/** Short relative age («٣ أيام» / "3d") for dense columns. */
export function formatAge(iso: string, locale: string, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'ar', {
    numeric: 'auto',
    style: 'narrow',
  });
  let text: string;
  if (minutes < 60) text = rtf.format(-minutes, 'minute');
  else if (minutes < 60 * 24) text = rtf.format(-Math.round(minutes / 60), 'hour');
  else if (minutes < 60 * 24 * 30) text = rtf.format(-Math.round(minutes / 1440), 'day');
  else text = rtf.format(-Math.round(minutes / 43_200), 'month');
  return formatDigits(text);
}
