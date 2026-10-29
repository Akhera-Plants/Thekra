import { formatPlanAmount, type PlanUnit, type RakahCount } from '@thekra/practice-core';

/**
 * «10 دقيقة», «33 مرة», «صدقة» (one unit) or «2 × صدقة», and prayers counted in rak'ahs («4 ركعات»). The unit label
 * is the catalog's own wording; numbers are Western digits.
 */
export function amountLabel(amount: number, unit: PlanUnit, unitLabel: string, english: boolean, rakah?: RakahCount): string {
  return formatPlanAmount(amount, unit, unitLabel, english ? 'en' : 'ar', rakah);
}
