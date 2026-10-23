import { parseTextReview, unfeaturableTextIds } from './text-review.js';

describe('parseTextReview', () => {
  it('reads ids and decisions, empty meaning not reviewed', () => {
    const rows = parseTextReview([
      'texts:',
      '  # "كل معروف صدقة"',
      '  - { id: 11111111-1111-4111-8111-111111111111, ref: "مسلم 1005", reason: short, decision: COMPLETE }',
      '  - { id: 22222222-2222-4222-8222-222222222222, ref: "البخاري 1992", reason: short, decision:  }',
    ].join('\n'));
    expect(rows).toEqual([
      { id: '11111111-1111-4111-8111-111111111111', decision: 'COMPLETE' },
      { id: '22222222-2222-4222-8222-222222222222', decision: null },
    ]);
  });

  it('rejects an unknown decision instead of silently featuring the text', () => {
    expect(() =>
      parseTextReview('  - { id: 11111111-1111-4111-8111-111111111111, reason: short, decision: KEEP }'),
    ).toThrow(/COMPLETE, FRAGMENT or empty/);
  });

  it('loads the committed review file', () => {
    expect(unfeaturableTextIds().length).toBeGreaterThan(0);
  });
});
