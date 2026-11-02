import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { hiddenQuoteIds, isHiddenQuote, parseHiddenQuotes } from './hidden-quotes.js';

describe('parseHiddenQuotes', () => {
  it('reads ids, reasons and decisions, empty meaning not reviewed', () => {
    const rows = parseHiddenQuotes([
      'texts:',
      '  # لا حلقة راوٍ: "قد أمر بقتل الحيات"',
      '  - { id: 11111111-1111-4111-8111-111111111111, ref: "البخاري 3297", reason: no-narrator-link, decision:  }',
      '  - { id: 22222222-2222-4222-8222-222222222222, ref: "مسلم 1", reason: boundary, decision: SHOW }',
    ].join('\n'));
    expect(rows).toEqual([
      { id: '11111111-1111-4111-8111-111111111111', reason: 'no-narrator-link', decision: null },
      { id: '22222222-2222-4222-8222-222222222222', reason: 'boundary', decision: 'SHOW' },
    ]);
  });

  it('rejects an unknown decision instead of silently showing the text', () => {
    expect(() =>
      parseHiddenQuotes('  - { id: 11111111-1111-4111-8111-111111111111, ref: "x", reason: boundary, decision: KEEP }'),
    ).toThrow(/SHOW, HIDE or empty/);
  });

  it('rejects an id listed twice', () => {
    const line = '  - { id: 11111111-1111-4111-8111-111111111111, ref: "x", reason: boundary, decision:  }';
    expect(() => parseHiddenQuotes(`${line}\n${line}`)).toThrow(/listed twice/);
  });

  it('loads the committed list: the 233 texts with no automatic proposal', () => {
    expect(parseHiddenQuotes(readTaxonomyFile('hidden-quotes.yaml'))).toHaveLength(233);
    const ids = hiddenQuoteIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(isHiddenQuote(ids[0] as string)).toBe(true);
    expect(isHiddenQuote('00000000-0000-4000-8000-000000000000')).toBe(false);
  });
});
