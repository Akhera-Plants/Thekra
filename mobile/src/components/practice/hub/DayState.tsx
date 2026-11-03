/**
 * «حال يومي» at the end of «اليوم» (owner, 2026-11-03: never two loose chips): one small outlined control that names
 * the day's state when one is set («يومي ثقيل», «عذر (مرض أو سفر)»), and opens a short sheet with the two switches,
 * each with its one-line effect:
 * - «يومي ثقيل»: every habit asks for its smallest amount today (practice-core `setHeavyDay`, today only);
 * - «عذر (مرض أو سفر)»: the day neither breaks nor adds to the streak (practice-core `toggleExcusedDay`).
 * Hidden without a habit.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudSun } from 'lucide-react-native';
import type { LocalDate } from '@thekra/practice-core';
import { useExcuse, useHeavyDay } from '@/lib/practice/use-habits-hub';
import { Button, Rule, SwitchRow } from '@/ui';
import { BottomSheet } from '../mujahada/Sheet';

export function DayState({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const heavyDay = useHeavyDay(today);
  const excuse = useExcuse(today, today);
  if (!heavyDay.hasPlans) return null;
  const label = heavyDay.heavy ? t('practice.heavyDay') : excuse.excused ? t('practice.excuse.day') : t('practice.dayState.button');
  return (
    <>
      <Button
        label={label}
        icon={CloudSun}
        variant={heavyDay.heavy || excuse.excused ? 'outline' : 'ghost'}
        compact
        onPress={() => setOpen(true)}
        accessibilityLabel={`${t('practice.dayState.button')}: ${label}`}
      />
      <BottomSheet visible={open} title={t('practice.dayState.button')} onClose={() => setOpen(false)}>
        <SwitchRow
          label={t('practice.heavyDay')}
          hint={t('practice.dayState.heavyHint')}
          value={heavyDay.heavy}
          onValueChange={heavyDay.setHeavy}
        />
        {excuse.allowed ? (
          <>
            <Rule />
            <SwitchRow
              label={t('practice.excuse.day')}
              hint={t('practice.excuse.hint')}
              value={excuse.excused}
              onValueChange={excuse.toggle}
            />
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}
