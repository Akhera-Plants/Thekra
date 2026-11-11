import { useLocale, useTranslations } from 'next-intl';
import { updatePlan, type Plan } from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';
import type { PracticeHabit } from '@/lib/types/practice';
import { amountLabel } from './amount-label';

/** One plan change through the device store (synced like every plan edit). */
export function changePlan(id: string, change: (plan: Plan) => Plan): void {
  updateStore((store) => updatePlan(store, id, change));
}

/** Hook for the plan's title and unit wording in the page language. */
export function usePlanWords(plan: Plan, habit: PracticeHabit | undefined) {
  const locale = useLocale();
  const t = useTranslations('practice.units');
  const english = locale === 'en';
  const title = habit ? (english ? habit.titleEn : habit.titleAr) : plan.title;
  const catalogUnit = habit ? (english ? habit.unitLabelEn : habit.unitLabelAr) : t(plan.unit);
  // The number fields count units; for prayers the word says how a unit maps to rak'ahs.
  const unit = habit?.rakah ? t(habit.rakah === 'pairs' ? 'rakahPairs' : 'rakahOdd') : catalogUnit;
  // Without the catalog the stored (Arabic) title is all there is: mark it as Arabic on /en.
  const titleLang = !habit && english ? 'ar' : undefined;
  return { title, titleLang, unit, amount: (n: number) => amountLabel(n, plan.unit, unit, english, habit?.rakah) };
}
