import { describe, expect, it } from 'vitest';
import { createPlan, logForDay, type Plan } from '@thekra/practice-core';
import { dayDoneLine, DAY_DONE_LINES, weeklyCommitment } from './commitment';

const TODAY = '2026-11-02';

function plan(id: string, createdOn: string): Plan {
  return createPlan({ id, deedSlug: 'quran', title: 'ورد', unit: 'minutes', amount: 5, activeDaysPerWeek: 7, slots: ['06:00'], createdOn });
}

function logged(p: Plan, days: string[]): Plan {
  return days.reduce((acc, d) => logForDay(acc, d, 5, d), p);
}

function lastDays(n: number, from = TODAY): string[] {
  const out: string[] = [];
  const base = new Date(`${from}T00:00:00Z`).getTime();
  for (let i = 1; i <= n; i++) out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

describe('commitment', () => {
  it('gives eight weekly bars, null before the habit began', () => {
    const p = logged(plan('a', '2026-10-20'), lastDays(5));
    const bars = weeklyCommitment(p, TODAY);
    expect(bars).toHaveLength(8);
    expect(bars[7]?.to).toBe(TODAY);
    expect(bars[0]?.ratio).toBeNull();
    expect(bars[7]?.ratio).toBeCloseTo(5 / 7);
  });

  it('rotates the day-done line by day', () => {
    const line = dayDoneLine(TODAY);
    expect(line).toBeGreaterThanOrEqual(1);
    expect(line).toBeLessThanOrEqual(DAY_DONE_LINES);
    expect(dayDoneLine('2026-11-03')).not.toBe(line);
  });
});
