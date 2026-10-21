import { describe, expect, it } from 'vitest';
import { featuredVerseScale } from './verse-scale';

describe('featuredVerseScale', () => {
  it('keeps a short verse at the large size', () => {
    expect(featuredVerseScale(80)).toBe('');
  });

  it('steps a medium passage down', () => {
    expect(featuredVerseScale(180)).toBe('is-medium');
  });

  it('marks a long narration for the smallest clamped size', () => {
    expect(featuredVerseScale(600)).toBe('is-long');
  });
});
