import { useState } from 'react';
import { addDays } from '@thekra/practice-core';
import { monthOf, type YearMonth } from '@/lib/practice/hub';

export interface DaySelection {
  /** The chosen day; today until the visitor picks another one (and again after «اليوم»). */
  selected: string;
  /** The month the grid shows: the selected day's month until the visitor pages through months. */
  month: YearMonth;
  isToday: boolean;
  select: (date: string) => void;
  shiftWeek: (weeks: number) => void;
  showMonth: (month: YearMonth) => void;
}

/**
 * One selected day shared by the week strip, the day list and the month grid. Following today is the default, so a
 * page left open past midnight moves to the new day by itself. Null until the device clock is read.
 */
export function useDaySelection(today: string | null): DaySelection | null {
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedMonth, setPickedMonth] = useState<YearMonth | null>(null);
  if (!today) return null;
  const selected = picked ?? today;

  function select(date: string) {
    setPicked(date === today ? null : date);
    setPickedMonth(null);
  }

  return {
    selected,
    month: pickedMonth ?? monthOf(selected),
    isToday: selected === today,
    select,
    shiftWeek: (weeks) => select(addDays(selected, weeks * 7)),
    showMonth: setPickedMonth,
  };
}
