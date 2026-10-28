import type { PlanUnit } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';

/**
 * «10 دقيقة», «33 مرة», «ركعتان» (one unit) or «2 × ركعتان». The unit label is the catalog's own
 * wording; numbers are Western digits.
 */
export function amountLabel(amount: number, unit: PlanUnit, unitLabel: string): string {
  if (unit === 'times') return amount === 1 ? unitLabel : `${formatDigits(amount)} × ${unitLabel}`;
  return `${formatDigits(amount)} ${unitLabel}`;
}
