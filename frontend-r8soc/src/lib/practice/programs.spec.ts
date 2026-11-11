import { describe, expect, it } from 'vitest';
import { endProgram, hopeTextFor as hopeQuoteId, momentProgram, resolveLimit, shortestTextId as shortestQuoteId, startProgram } from '@thekra/practice-core';
import type { QuoteDto } from '@/lib/types/api';
import type { SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { programTextIds } from './programs';

const NOW = '2026-10-01T10:00:00.000Z';
const program = (slug: string, startedOn: string) =>
  startProgram({ sinSlug: slug, category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn }, NOW);
const quote = (id: string, textAr: string) => ({ id, textAr }) as QuoteDto;

describe('«لحظة مجاهدة» program', () => {
  const a = program('a', '2026-10-01');
  const b = program('b', '2026-10-20');
  it('uses the program in focus without a hand-off', () => {
    expect(momentProgram([a, b], undefined, '2026-10-21')?.sinSlug).toBe('b');
    expect(momentProgram([a, b], null, '2026-10-21')?.sinSlug).toBe('b');
  });
  it("uses a sin page's program only when the visitor follows it, otherwise nothing", () => {
    expect(momentProgram([a, b], 'a', '2026-10-21')?.sinSlug).toBe('a');
    expect(momentProgram([a, b], 'c', '2026-10-21')).toBeNull();
    expect(momentProgram([endProgram(a, NOW)], 'a', '2026-10-21')).toBeNull();
    expect(momentProgram([], null, '2026-10-21')).toBeNull();
  });
});

describe('limits and texts', () => {
  it('resolves a program step or a generic key', () => {
    expect(resolveLimit('action:1', ['x', 'y'])).toEqual({ kind: 'action', text: 'y' });
    expect(resolveLimit('action:5', ['x'])).toBeNull();
    expect(resolveLimit('phone_outside_room', [])).toEqual({ kind: 'generic', key: 'phone_outside_room' });
  });

  it('picks the shortest fetched text for «تب الآن» and another one as hope', () => {
    const quotes = [quote('1', 'طويل جدًا جدًا'), quote('2', 'قصير')];
    expect(shortestQuoteId(['1', '2', '3'], quotes)).toBe('2');
    expect(shortestQuoteId(['3'], quotes)).toBeNull();
    expect(hopeQuoteId(['1', '2', '3'], quotes, '2026-10-01', '2')).toBe('1');
    expect(hopeQuoteId(['2'], quotes, '2026-10-01', '2')).toBe('2');
    expect(hopeQuoteId(['3'], quotes, '2026-10-01', null)).toBeNull();
  });

  it('lists the program texts and the stage texts once', () => {
    const entry = { evidence: ['a', 'b'] } as SinProgramEntry;
    const common = { stages: { harms: { evidence: ['b', 'c'] }, leave: {} } } as unknown as SinProgramCommon;
    expect(programTextIds(entry, common, 'harms')).toEqual(['a', 'b', 'c']);
    expect(programTextIds(entry, common, 'leave')).toEqual(['a', 'b']);
  });
});
