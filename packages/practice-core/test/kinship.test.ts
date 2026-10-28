import { describe, expect, it } from 'vitest';
import {
  createRelative,
  dueList,
  logContact,
  looksLikeContactDetails,
  nextDue,
  undoLastContact,
  validateRelative,
  type Relative,
} from '../src/index.js';

const TODAY = '2026-10-28'; // Wednesday

function rel(id: string, name: string, rule: Relative['rule'], lastContactedOn?: string): Relative {
  const r = createRelative({ id, name, relation: 'خالة', rule });
  return lastContactedOn ? logContact(r, lastContactedOn) : r;
}

describe('looksLikeContactDetails', () => {
  it('flags phone numbers in Latin, Arabic-Indic and Persian digits', () => {
    expect(looksLikeContactDetails('0791234567')).toBe(true);
    expect(looksLikeContactDetails('خالتي +962 79 123-4567')).toBe(true);
    expect(looksLikeContactDetails('(079) 123.4567')).toBe(true);
    expect(looksLikeContactDetails('٠٧٩١٢٣٤٥٦٧')).toBe(true);
    expect(looksLikeContactDetails('۰۷۹۱۲۳۴۵۶۷')).toBe(true);
  });

  it('flags emails and links', () => {
    expect(looksLikeContactDetails('aunt@example.com')).toBe(true);
    expect(looksLikeContactDetails('https://wa.me/962791234567')).toBe(true);
    expect(looksLikeContactDetails('www.example.com')).toBe(true);
  });

  it('allows names and short numbers', () => {
    expect(looksLikeContactDetails('خالتي أم محمد')).toBe(false);
    expect(looksLikeContactDetails('عمي، أبو 3 أولاد')).toBe(false);
    expect(looksLikeContactDetails('جدتي 2026')).toBe(false);
    expect(looksLikeContactDetails('Uncle Ali')).toBe(false);
  });
});

describe('createRelative / validateRelative', () => {
  it('rejects contact details and unsupported rules', () => {
    expect(() => createRelative({ id: 'r', name: 'خالتي 0791234567', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } })).toThrow(
      /contact details/,
    );
    expect(() => createRelative({ id: 'r', name: ' ', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } })).toThrow();
    expect(() => createRelative({ id: 'r', name: 'x'.repeat(61), relation: '', rule: { kind: 'weekdays', days: [5] } })).toThrow();
    expect(validateRelative({ id: 'r', name: 'خالتي', relation: '', rule: { kind: 'daily' }, history: [] })).toMatch(/rule/);
    expect(validateRelative({ id: 'r', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 0, anchor: TODAY }, history: [] })).toMatch(
      /n must/,
    );
  });
});

describe('nextDue', () => {
  it('a relative never contacted is due now', () => {
    expect(nextDue(rel('a', 'a', { kind: 'everyNDays', n: 7, anchor: '2026-01-01' }), TODAY)).toBe(TODAY);
    expect(nextDue(rel('a', 'a', { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-01-01' }), TODAY)).toBe('2026-10-30');
    expect(nextDue(rel('a', 'a', { kind: 'weekdays', days: [3] }), TODAY)).toBe(TODAY);
  });

  it('everyNDays restarts from the last contact', () => {
    expect(nextDue(rel('a', 'a', { kind: 'everyNDays', n: 10, anchor: '2026-01-01' }, '2026-10-20'), TODAY)).toBe('2026-10-30');
  });

  it('everyNWeeks: last + 7n, moved forward to the weekday', () => {
    const r = { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-01-01' } as const;
    expect(nextDue(rel('a', 'a', r, '2026-10-23'), TODAY)).toBe('2026-10-30'); // Friday → next Friday
    expect(nextDue(rel('a', 'a', r, '2026-10-22'), TODAY)).toBe('2026-10-30'); // Thursday → +7 Thursday → Friday
    expect(nextDue(rel('a', 'a', { ...r, n: 2 }, '2026-10-23'), TODAY)).toBe('2026-11-06');
  });

  it('weekdays: the first listed day strictly after the last contact', () => {
    expect(nextDue(rel('a', 'a', { kind: 'weekdays', days: [1, 4] }, '2026-10-26'), TODAY)).toBe('2026-10-29');
    expect(nextDue(rel('a', 'a', { kind: 'weekdays', days: [1] }, '2026-10-26'), TODAY)).toBe('2026-11-02');
  });
});

describe('dueList', () => {
  it('buckets overdue / this week / later, sorted by due date then name', () => {
    const list = dueList(
      [
        rel('1', 'عمتي', { kind: 'everyNDays', n: 7, anchor: TODAY }, '2026-10-01'), // due 10-08: overdue
        rel('2', 'جدي', { kind: 'everyNDays', n: 30, anchor: TODAY }, '2026-10-20'), // due 11-19: later
        rel('3', 'خالتي', { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: TODAY }, '2026-10-23'), // 10-30: this week
        rel('4', 'أخي', { kind: 'everyNDays', n: 7, anchor: TODAY }), // never contacted: today
        rel('5', 'عمي', { kind: 'everyNDays', n: 5, anchor: TODAY }, '2026-10-20'), // 10-25: overdue
        rel('6', 'خالي', { kind: 'everyNDays', n: 10, anchor: TODAY }, '2026-10-24'), // 11-03: this week (today+6)
        rel('7', 'جدتي', { kind: 'everyNDays', n: 11, anchor: TODAY }, '2026-10-24'), // 11-04: later (today+7)
      ],
      TODAY,
    );
    expect(list.overdue.map((e) => [e.relative.id, e.nextDue, e.daysUntilDue])).toEqual([
      ['1', '2026-10-08', -20],
      ['5', '2026-10-25', -3],
    ]);
    expect(list.thisWeek.map((e) => [e.relative.id, e.nextDue])).toEqual([
      ['4', TODAY],
      ['3', '2026-10-30'],
      ['6', '2026-11-03'],
    ]);
    expect(list.later.map((e) => e.relative.id)).toEqual(['7', '2']);
  });
});

describe('logContact / undoLastContact', () => {
  it('restarts the cycle, never moves backwards on a backdated log, and undo restores', () => {
    const r0 = rel('a', 'خالتي', { kind: 'everyNDays', n: 7, anchor: TODAY });
    const r1 = logContact(r0, '2026-10-20');
    const r2 = logContact(r1, '2026-10-27');
    expect(r2.lastContactedOn).toBe('2026-10-27');
    expect(nextDue(r2, TODAY)).toBe('2026-11-03');
    const backdated = logContact(r2, '2026-10-25');
    expect(backdated.lastContactedOn).toBe('2026-10-27');
    expect(backdated.history).toEqual(['2026-10-20', '2026-10-27', '2026-10-25']);
    expect(undoLastContact(backdated).lastContactedOn).toBe('2026-10-27');
    expect(undoLastContact(r2).lastContactedOn).toBe('2026-10-20');
    const empty = undoLastContact(undoLastContact(r2));
    expect('lastContactedOn' in empty).toBe(false);
    expect(empty.history).toEqual([]);
    expect(undoLastContact(empty).history).toEqual([]);
    expect(logContact(r2, '2026-10-27').history).toEqual(['2026-10-20', '2026-10-27']);
    expect(r0.history).toEqual([]);
  });
});
