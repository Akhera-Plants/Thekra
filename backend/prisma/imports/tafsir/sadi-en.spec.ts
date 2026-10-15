import { describe, expect, it } from 'vitest';
import { plainSadiEn } from './sadi-en.js';

describe('plainSadiEn', () => {
  it('joins translation quotes and commentary paragraphs', () => {
    const text = plainSadiEn([
      {
        kind: 'quote',
        source: 'Translation',
        runs: [
          { kind: 'text', text: '65:2. When they have approached' },
          { kind: 'pageBreak', volume: 10, page: 135 },
          { kind: 'text', text: ' their waiting periods.' },
        ],
      },
      {
        kind: 'paragraph',
        runs: [
          { kind: 'text', text: 'Here Allah (' },
          { kind: 'arabic', text: 'سبحانه' },
          { kind: 'text', text: ') says…' },
        ],
      },
    ]);
    expect(text).toContain('65:2. When they have approached their waiting periods.');
    expect(text).toContain('Here Allah (سبحانه) says…');
    expect(text).not.toContain('pageBreak');
  });
});
