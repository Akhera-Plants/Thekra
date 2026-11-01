/**
 * «ترك المعصية» list changes (several side by side; end markers kept only for the vault) and the private notebook.
 */

import { checkIn, isActiveProgram, startProgram, type SinProgram } from '@thekra/practice-core';
import {
  categoryFromAnswer,
  foldSearch,
  notebookEntries,
  programEntry,
  sinChoices,
  withProgramEnded,
  withProgramStarted,
} from '../lib/practice/sin-program-view';

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
    expect(notebookEntries(p, '2026-10-27').map((c) => [c.date, c.value, c.note])).toEqual([
      ['2026-10-27', 'weak', undefined],
      ['2026-10-26', 'held', 'first'],
    ]);
    expect(notebookEntries(p, '2026-10-28', 1).map((c) => c.date)).toEqual(['2026-10-28']);
  });
});

describe('every sin can start «تخفَّف»', () => {
  const written = { sin: 'ghibah', category: 'haqq_ibad' as const, gradualAllowed: false, help: true, actionsAr: ['أ'], evidence: ['q1'] };

  it('uses the written program when there is one, whatever the answer', () => {
    expect(programEntry([written], 'ghibah', null)).toMatchObject({ sin: 'ghibah', category: 'haqq_ibad', actionsAr: ['أ'], actionsEn: [] });
  });

  it('needs the category for a sin without a written program, then gives the common one', () => {
    expect(programEntry([written], 'kadhib', null)).toBeNull();
    expect(programEntry([written], 'kadhib', categoryFromAnswer(true))).toEqual({
      sin: 'kadhib',
      category: 'haqq_ibad',
      gradualAllowed: false,
      help: false,
      actionsAr: [],
      actionsEn: [],
      alternatives: [],
      evidence: [],
    });
    expect(categoryFromAnswer(false)).toBe('haqq_allah');
  });

  it('lists all sins not followed, written programs first, searchable without diacritics', () => {
    const sins = [
      { slug: 'kadhib', name: 'الكَذِب' },
      { slug: 'ghibah', name: 'الغيبة' },
      { slug: 'hasad', name: 'الحسد' },
    ];
    expect(sinChoices(sins, [written], new Set(['hasad'])).map((c) => [c.slug, Boolean(c.written)])).toEqual([
      ['ghibah', true],
      ['kadhib', false],
    ]);
    expect(sinChoices(sins, [written], new Set(), 'كذب').map((c) => c.slug)).toEqual(['kadhib']);
    expect(foldSearch('الغِيبةُ')).toBe('الغيبه');
  });
});
