'use client';

import { useLocale } from 'next-intl';
import { formatDigits } from '@/lib/format/digits';
import { usePreferencesStore } from '@/lib/stores/preferences.store';

/**
 * Renders a number with the person's numeral preference.
 * Arabic pages default to Arabic-Indic digits (`arabicNumerals`, default true).
 */
export function FormattedNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const locale = useLocale();
  const arabicNumerals = usePreferencesStore((state) => state.arabicNumerals);
  const arabic = locale === 'ar' ? true : arabicNumerals;

  return <bdi className={className}>{formatDigits(value, arabic)}</bdi>;
}
