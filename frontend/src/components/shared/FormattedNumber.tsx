'use client';

import { formatDigits } from '@/lib/format/digits';

/** Renders a number with Western digits (0–9) in every locale. */
export function FormattedNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return <bdi className={className}>{formatDigits(value)}</bdi>;
}
