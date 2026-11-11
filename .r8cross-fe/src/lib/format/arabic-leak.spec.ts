import { describe, expect, it } from 'vitest';
import { arabicLeaks } from './arabic-leak';

describe('arabicLeaks', () => {
  it('reports Arabic script lines', () => {
    expect(arabicLeaks('Guarding the tongue\nحفظ اللسان')).toEqual(['حفظ اللسان']);
  });

  it('allows pure English', () => {
    expect(arabicLeaks('Branch 30\nSunan Abi Dawud 5186')).toEqual([]);
  });
});
