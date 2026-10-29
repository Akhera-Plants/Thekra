import { describe, expect, it } from 'vitest';
import {
  DISMISSED_MAX,
  MUHASABA_ANSWER_MAX,
  NIYYAH_NOTE_MAX,
  celebrationLine,
  deleteDay,
  dismiss,
  duePrompt,
  emptyJournal,
  intendedPlan,
  notebook,
  parseJournal,
  promptKey,
  serializeJournal,
  setMuhasaba,
  setNiyyah,
  validateMuhasaba,
  validateNiyyah,
  type PromptContext,
} from '../src/index.js';

const T = '2026-10-29T06:00:00.000Z';

describe('journal entries', () => {
  it('keeps one entry per day, newest first, with the intention and the evening together', () => {
    let j = setNiyyah(emptyJournal(), '2026-10-28', { planId: 'p1', title: '  الضحى ', note: ' لله وحده ' }, T);
    j = setNiyyah(j, '2026-10-29', { planId: 'p2', title: 'الوتر' }, T);
    j = setMuhasaba(j, '2026-10-28', { answers: { helped: ' صحبة طيبة ', away: '' }, thanked: true }, T);
    expect(notebook(j).map((d) => d.date)).toEqual(['2026-10-29', '2026-10-28']);
    expect(j.days[1]).toEqual({
      date: '2026-10-28',
      niyyah: { planId: 'p1', title: 'الضحى', note: 'لله وحده', at: T },
      muhasaba: { answers: { helped: 'صحبة طيبة' }, thanked: true, at: T },
    });
    expect(intendedPlan(j, '2026-10-29')).toBe('p2');
    expect(intendedPlan(j, '2026-10-27')).toBeNull();
  });

  it('replaces the day on a second save and deletes a whole day', () => {
    let j = setNiyyah(emptyJournal(), '2026-10-29', { planId: 'p1', title: 'الضحى' }, T);
    j = setNiyyah(j, '2026-10-29', { planId: 'p2', title: 'الوتر' }, T);
    expect(j.days).toHaveLength(1);
    expect(intendedPlan(j, '2026-10-29')).toBe('p2');
    expect(deleteDay(j, '2026-10-29').days).toEqual([]);
  });

  it('refuses an empty evening entry and over-long text', () => {
    expect(validateMuhasaba({ answers: {}, thanked: false })).not.toBeNull();
    expect(validateMuhasaba({ answers: { helped: '   ' }, thanked: false })).not.toBeNull();
    expect(validateMuhasaba({ answers: {}, thanked: true })).toBeNull();
    expect(validateMuhasaba({ answers: { tomorrow: 'x'.repeat(MUHASABA_ANSWER_MAX + 1) }, thanked: true })).not.toBeNull();
    expect(validateMuhasaba({ answers: { other: 'x' }, thanked: true })).not.toBeNull();
    expect(validateNiyyah({ planId: 'p1', title: 'الضحى', note: 'x'.repeat(NIYYAH_NOTE_MAX + 1) })).not.toBeNull();
    expect(validateNiyyah({ planId: '', title: 'الضحى' })).not.toBeNull();
    expect(() => setMuhasaba(emptyJournal(), '2026-10-29', { answers: {}, thanked: false }, T)).toThrow(RangeError);
    expect(() => setNiyyah(emptyJournal(), 'not-a-day', { planId: 'p1', title: 'x' }, T)).toThrow(RangeError);
  });
});

describe('parseJournal', () => {
  it('round-trips and never throws', () => {
    const j = setMuhasaba(setNiyyah(emptyJournal(), '2026-10-29', { planId: 'p1', title: 'الضحى' }, T), '2026-10-29', { answers: { tomorrow: 'ركعتان' }, thanked: false }, T);
    expect(parseJournal(serializeJournal(dismiss(j, 'niyyah:2026-10-30')))).toEqual(dismiss(j, 'niyyah:2026-10-30'));
    expect(parseJournal('{oops')).toEqual(emptyJournal());
    expect(parseJournal({ v: 9, days: [] })).toEqual(emptyJournal());
    expect(parseJournal(null)).toEqual(emptyJournal());
  });

  it('drops invalid days and stray fields, and keeps the first entry of a repeated date', () => {
    const parsed = parseJournal({
      v: 1,
      days: [
        { date: '2026-10-29', niyyah: { planId: 'p1', title: 'الضحى', at: T, extra: 'x' }, secret: 1 },
        { date: '2026-10-29', niyyah: { planId: 'p2', title: 'الوتر', at: T } },
        { date: 'bad', niyyah: { planId: 'p1', title: 'x', at: T } },
        { date: '2026-10-28', muhasaba: { answers: {}, thanked: false, at: T } },
        { date: '2026-10-27', niyyah: { planId: 'p1', title: 'x', at: 'yesterday' } },
      ],
      dismissed: ['muhasaba:2026-10-29', 3, ''],
    });
    expect(parsed).toEqual({
      v: 1,
      days: [{ date: '2026-10-29', niyyah: { planId: 'p1', title: 'الضحى', at: T } }],
      dismissed: ['muhasaba:2026-10-29'],
    });
  });

  it('keeps only the newest dismissed keys', () => {
    let j = emptyJournal();
    for (let i = 0; i < DISMISSED_MAX + 5; i++) j = dismiss(j, `k${i}`);
    expect(j.dismissed).toHaveLength(DISMISSED_MAX);
    expect(j.dismissed[0]).toBe('k5');
    expect(dismiss(j, `k${DISMISSED_MAX + 4}`)).toBe(j);
  });
});

describe('duePrompt', () => {
  const ctx = (time: string, more: Partial<PromptContext> = {}): PromptContext => ({
    date: '2026-10-29',
    time,
    hasHabitsToday: true,
    started: true,
    ...more,
  });

  it('asks for the intention in the morning until noon, only with habits today', () => {
    expect(duePrompt(emptyJournal(), ctx('03:59'))).toBeNull();
    expect(duePrompt(emptyJournal(), ctx('04:00'))).toBe('niyyah');
    expect(duePrompt(emptyJournal(), ctx('11:59'))).toBe('niyyah');
    expect(duePrompt(emptyJournal(), ctx('12:00'))).toBeNull();
    expect(duePrompt(emptyJournal(), ctx('08:00', { hasHabitsToday: false }))).toBeNull();
  });

  it('stops once the intention is set or set aside for the day', () => {
    const set = setNiyyah(emptyJournal(), '2026-10-29', { planId: 'p1', title: 'الضحى' }, T);
    expect(duePrompt(set, ctx('08:00'))).toBeNull();
    expect(duePrompt(set, ctx('08:00', { date: '2026-10-30' }))).toBe('niyyah');
    expect(duePrompt(dismiss(emptyJournal(), promptKey('niyyah', '2026-10-29')), ctx('08:00'))).toBeNull();
  });

  it('asks the evening questions from Maghrib, or 18:00 without it, until midnight', () => {
    expect(duePrompt(emptyJournal(), ctx('17:59'))).toBeNull();
    expect(duePrompt(emptyJournal(), ctx('18:00'))).toBe('muhasaba');
    expect(duePrompt(emptyJournal(), ctx('23:59'))).toBe('muhasaba');
    expect(duePrompt(emptyJournal(), ctx('17:20', { eveningFrom: '17:12' }))).toBe('muhasaba');
    expect(duePrompt(emptyJournal(), ctx('17:00', { eveningFrom: '17:12' }))).toBeNull();
    expect(duePrompt(emptyJournal(), ctx('19:00', { started: false }))).toBeNull();
    const done = setMuhasaba(emptyJournal(), '2026-10-29', { answers: {}, thanked: true }, T);
    expect(duePrompt(done, ctx('20:00'))).toBeNull();
    expect(duePrompt(dismiss(emptyJournal(), promptKey('muhasaba', '2026-10-29')), ctx('20:00'))).toBeNull();
  });
});

describe('celebrationLine', () => {
  it('takes the lines in turn and wraps', () => {
    const lines = ['a', 'b', 'c'];
    expect([0, 1, 2, 3, 7].map((n) => celebrationLine(lines, n))).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(celebrationLine(lines, -1)).toBe('c');
    expect(celebrationLine([], 2)).toBeNull();
  });
});
