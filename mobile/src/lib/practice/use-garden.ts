/**
 * «بستاني»: the plants of the device store (practice-core plans and relatives, never the sin programs), each named by
 * its catalog habit title, from the pure growth rules in garden.ts.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from './catalog-types';
import { gardenPlants, type GardenPlant } from './garden';
import { today, usePracticeStore } from './practice-store';
import { habitFor } from './reminders';
import { useUiLocale } from './use-practice-lifecycle';

export function useGardenPlants(): GardenPlant[] {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const plans = usePracticeStore((s) => s.store.plans);
  const relatives = usePracticeStore((s) => s.store.relatives);
  const habits = usePracticeCatalog(locale).data?.habits;
  const day = today();
  return useMemo(() => {
    const titleOf = (plan: Plan) => {
      const habit = habitFor(plan, habits ?? []);
      return habit ? pick(habit, 'title', locale) : plan.title;
    };
    return gardenPlants({ plans, relatives }, day, titleOf, t('kinship.title'));
  }, [plans, relatives, habits, locale, day, t]);
}
