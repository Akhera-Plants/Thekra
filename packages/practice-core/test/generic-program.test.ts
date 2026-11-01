import { describe, expect, it } from 'vitest';
import { genericProgramEntry, programEntryFor, startProgram, validateProgram } from '../src/index.js';

describe('generic program (every sin, owner 2026-11-01)', () => {
  const written = [{ sin: 'ghibah', category: 'haqq_ibad' as const, gradualAllowed: false, help: false, actionsAr: ['x'], actionsEn: ['x'], alternatives: [], evidence: ['e'] }];
  it('keeps a written program, else builds the common one once the category is known', () => {
    expect(programEntryFor(written, 'ghibah', null)).toBe(written[0]);
    expect(programEntryFor(written, 'kadhib', null)).toBeNull();
    expect(programEntryFor(written, 'kadhib', 'haqq_allah')).toEqual(genericProgramEntry('kadhib', 'haqq_allah'));
  });
  it('never offers a gradual path and starts a valid program', () => {
    const entry = genericProgramEntry('kadhib', 'haqq_allah');
    expect(entry.gradualAllowed).toBe(false);
    const program = startProgram({ sinSlug: entry.sin, category: entry.category, hardToLeaveAtOnce: false, startedOn: '2026-11-01' });
    expect(program.path).toBe('cut');
    expect(validateProgram(program)).toBeNull();
  });
});
