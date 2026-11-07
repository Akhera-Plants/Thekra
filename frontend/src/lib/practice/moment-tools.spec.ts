import { describe, expect, it } from 'vitest';
import type { MomentTools } from '@/lib/types/practice';
import { allMomentEvidenceIds, EVIDENCE_BATCH, evidenceBatches, momentToolsFor } from './moment-tools';

const tool = (key: string, evidence: string[]) => ({ key, titleAr: key, titleEn: key, evidence });
const moment: MomentTools = {
  generic: [tool('istiadha', ['g1', 'g2'])],
  sins: { ghadab: [tool('sit', ['a2', 'a1'])], empty: [] },
  aliases: { 'su-al-khuluq': 'ghadab' },
};

describe('momentToolsFor', () => {
  it('gives the sin its own acts, an alias the acts it points to, any other sin the generic ones', () => {
    expect(momentToolsFor(moment, 'ghadab')).toEqual({ tools: moment.sins.ghadab, own: true });
    expect(momentToolsFor(moment, 'su-al-khuluq')).toEqual({ tools: moment.sins.ghadab, own: true });
    expect(momentToolsFor(moment, 'other')).toEqual({ tools: moment.generic, own: false });
    expect(momentToolsFor(moment, 'empty')).toEqual({ tools: moment.generic, own: false });
    expect(momentToolsFor(moment, null)).toEqual({ tools: moment.generic, own: false });
  });

  it('has no acts before the catalog sends them', () => {
    expect(momentToolsFor(undefined, 'ghadab')).toEqual({ tools: [], own: false });
  });
});

describe('evidence requests', () => {
  it('asks every act of every sin, sorted and once (the same request for every member)', () => {
    expect(allMomentEvidenceIds(moment)).toEqual(['a1', 'a2', 'g1', 'g2']);
    expect(allMomentEvidenceIds(undefined)).toEqual([]);
  });

  it('splits a long list into fixed batches the API accepts', () => {
    const ids = Array.from({ length: EVIDENCE_BATCH * 2 + 3 }, (_, i) => `id-${String(i).padStart(3, '0')}`);
    const batches = evidenceBatches(ids);
    expect(batches.map((b) => b.length)).toEqual([EVIDENCE_BATCH, EVIDENCE_BATCH, 3]);
    expect(batches.flat()).toEqual(ids);
    expect(evidenceBatches([])).toEqual([]);
  });
});
