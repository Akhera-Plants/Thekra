import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { FRESH_START_KINDS, MUHASABA_QUESTIONS } from '@thekra/practice-core';
import { taxonomyFilePath } from '../taxonomy/taxonomy-files.js';
import { buildTazkiyaPrompts, tazkiyaPrompts } from './tazkiya-prompts.js';

const text = readFileSync(taxonomyFilePath('tazkiya-prompts.yaml'), 'utf8');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('tazkiya prompts — the real reviewer file', () => {
  const cwd = process.cwd();
  // The file resolves from the module (and is embedded in the bundle), never from process.cwd().
  beforeAll(() => process.chdir(tmpdir()));
  afterAll(() => process.chdir(cwd));

  const prompts = tazkiyaPrompts();

  it('is pending the sheikh and has every part in Arabic and English', () => {
    expect(prompts.review).toBe('pending-sheikh');
    expect(prompts.niyyah.introAr).not.toBe('');
    expect(prompts.muhasaba.questions.map((q) => q.key)).toEqual([...MUHASABA_QUESTIONS]);
    expect(prompts.freshStarts.occasions.map((o) => o.kind).sort()).toEqual([...FRESH_START_KINDS].sort());
    expect(prompts.celebrations.linesAr.length).toBe(prompts.celebrations.linesEn.length);
    expect(prompts.celebrations.linesAr.length).toBeGreaterThanOrEqual(3);
  });

  it('cites only public quote ids, and no visible line has an em dash, an en dash or Eastern digits', () => {
    for (const id of prompts.freshStarts.occasions.flatMap((o) => o.evidence ?? [])) expect(id).toMatch(UUID);
    const strings = JSON.stringify(prompts);
    expect(strings).not.toMatch(/[—–]/);
    expect(strings).not.toMatch(/[٠-٩۰-۹]/);
  });
});

describe('buildTazkiyaPrompts — validation', () => {
  const swap = (from: string, to: string) => {
    expect(text).toContain(from);
    return text.replace(from, to);
  };

  it('rejects unknown fields', () => {
    expect(() => buildTazkiyaPrompts(swap('niyyah:\n', 'niyyah:\n  extra: x\n'))).toThrow(/unknown field "extra"/);
  });

  it('rejects questions out of order or unknown', () => {
    expect(() => buildTazkiyaPrompts(swap('- key: helped', '- key: other'))).toThrow(/key must be one of/);
    expect(() => buildTazkiyaPrompts(swap('- key: helped', '- key: away'))).toThrow(/in this order/);
  });

  it('rejects a missing or repeated fresh-start kind and a bad evidence id', () => {
    expect(() => buildTazkiyaPrompts(swap('- kind: monday', '- kind: friday'))).toThrow(/"monday" is missing/);
    expect(() => buildTazkiyaPrompts(swap('28b92310-7fb6-4522-9d85-6a6c8282523f', 'not-an-id'))).toThrow(/is not valid/);
  });

  it('rejects unpaired supplication lists and a missing English text', () => {
    expect(() => buildTazkiyaPrompts(swap('    - تقبّل الله منك\n', '    - تقبّل الله منك\n    - زيادة\n'))).toThrow(/linesAr has/);
    expect(() => buildTazkiyaPrompts(swap('  thanksEn: Praise be to Allah for what was\n', ''))).toThrow(/thanksEn must be a non-empty string/);
  });
});
