import { describe, expect, it } from 'vitest';
import { OWNER_REVEALED_TARGHIB_IDS } from './ocr-gate.js';

describe('OWNER_REVEALED_TARGHIB_IDS', () => {
  it('pins the fifty Targhib rows the owner revealed', () => {
    expect(OWNER_REVEALED_TARGHIB_IDS).toHaveLength(50);
    expect(new Set(OWNER_REVEALED_TARGHIB_IDS).size).toBe(50);
  });
});
