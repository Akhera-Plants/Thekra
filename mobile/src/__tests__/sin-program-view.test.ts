/**
 * «ترك المعصية» list changes (several side by side; end markers kept only for the vault) and the private notebook.
 */

import { checkIn, isActiveProgram, startProgram, type SinProgram } from '@thekra/practice-core';
import { notebookEntries, withDeedAfterFall, withFall, withProgramEnded, withProgramStarted, withUrgePassed } from '../lib/practice/sin-program-view';

const NOW = '2026-10-29T10:00:00.000Z';
const program = (sinSlug: string): SinProgram =>
  startProgram({ sinSlug, category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, '2026-10-01T08:00:00.000Z');

describe('withProgramStarted', () => {
  it('runs the new program beside the active ones', () => {
    const a = program('a');
    const next = program('b');
    const result = withProgramStarted([a], next);
    expect(result).toEqual([a, next]);
    expect(result.filter(isActiveProgram).map((p) => p.sinSlug)).toEqual(['a', 'b']);
  });

  it('replaces an older (ended) copy of the same sin', () => {
    const ended = { ...program('c'), endedAt: NOW };
    expect(withProgramStarted([program('a'), ended], program('c')).map((p) => [p.sinSlug, p.endedAt])).toEqual([
      ['a', undefined],
      ['c', undefined],
    ]);
  });
});

describe('withProgramEnded', () => {
  it('ends one program, with or without a marker', () => {
    expect(withProgramEnded([program('a')], 'a', true, NOW)).toEqual([expect.objectContaining({ sinSlug: 'a', endedAt: NOW })]);
    expect(withProgramEnded([program('a'), program('b')], 'a', false).map((p) => p.sinSlug)).toEqual(['b']);
  });
});

describe('notebookEntries', () => {
  it('lists past check-ins with their notes, newest first', () => {
    let p = program('a');
    p = checkIn(p, '2026-10-26', 'held', 'first');
    p = checkIn(p, '2026-10-27', 'weak');
    p = checkIn(p, '2026-10-28', 'fell_repented', 'third');
    expect(notebookEntries(p, '2026-10-27').map((d) => [d.date, d.checkIn?.value, d.checkIn?.note])).toEqual([
      ['2026-10-27', 'weak', undefined],
      ['2026-10-26', 'held', 'first'],
    ]);
    expect(notebookEntries(p, '2026-10-28', 1).map((d) => d.date)).toEqual(['2026-10-28']);
  });

  it('lists a day with only a weak moment passed («لحظة ضعف عبرتها»)', () => {
    const p = withUrgePassed([checkIn(program('a'), '2026-10-26', 'held')], 'a', '2026-10-27', NOW)[0] as SinProgram;
    expect(notebookEntries(p, '2026-10-27').map((d) => [d.date, d.checkIn?.value ?? null, d.urgesPassed])).toEqual([
      ['2026-10-27', null, 1],
      ['2026-10-26', 'held', 0],
    ]);
  });
});

describe('the weak moment and the deed after a fall', () => {
  it('records only on the running program of that sin', () => {
    const ended = { ...program('b'), endedAt: NOW };
    const after = withUrgePassed([program('a'), ended], 'b', '2026-10-27', NOW);
    expect(after[1]).toBe(ended);
    expect(withUrgePassed([program('a')], 'a', '2026-10-27', NOW)[0]?.urges).toEqual([{ date: '2026-10-27', count: 1, updatedAt: NOW }]);
  });

  it('«وقعت» sets the day to fell_repented and keeps its note; «فعلتها» keeps the deed with it', () => {
    const noted = checkIn(program('a'), '2026-10-27', 'held', 'سرّ');
    const fell = withFall([noted], 'a', '2026-10-27', NOW);
    expect(fell[0]?.checkIns).toEqual([{ date: '2026-10-27', value: 'fell_repented', note: 'سرّ', updatedAt: NOW }]);
    const done = withDeedAfterFall(fell, 'a', '2026-10-27', 'dhikr', NOW);
    expect(done[0]?.checkIns[0]?.deed).toBe('dhikr');
  });
});
