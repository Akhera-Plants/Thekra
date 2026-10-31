/**
 * «عذر (مرض أو سفر)» for one day as a chip: an excused day neither breaks nor adds to the streak (practice-core
 * `toggleExcusedDay`, kept in the synced settings). Hidden for a day that cannot be excused.
 */

import React from 'react';
import type { LocalDate } from '@thekra/practice-core';
import { useExcuse } from '@/lib/practice/use-habits-hub';
import { Chip } from '@/ui';

export function ExcuseChip({ date, today, label }: { date: LocalDate; today: LocalDate; label: string }) {
  const excuse = useExcuse(date, today);
  if (!excuse.allowed) return null;
  return <Chip label={label} selected={excuse.excused} onPress={excuse.toggle} />;
}
