import { describe, expect, it } from 'vitest';
import { mujahadaIds, mujahadaIndex, mujahadaItems, rewardRange } from './mujahada';

const texts = {
  verses: [['v1', 'v2'], ['v3'], []],
  sayings: ['s1'],
  multiplierHadith: 'h1',
  sittingPrayerHadith: null,
  easyHighReward: ['birr'],
};

describe('mujahada', () => {
  it('writes a count as ten up to seven hundred times', () => {
    expect(rewardRange(33)).toEqual({ min: 330, max: 23_100 });
    expect(rewardRange(-2)).toEqual({ min: 0, max: 0 });
  });

  it('rotates passages and sayings, and reads every id once', () => {
    expect(mujahadaItems(texts)).toEqual([
      { kind: 'passage', ids: ['v1', 'v2'] },
      { kind: 'passage', ids: ['v3'] },
      { kind: 'saying', id: 's1' },
    ]);
    expect(mujahadaIds(texts)).toEqual(['v1', 'v2', 'v3', 's1', 'h1']);
    expect(mujahadaItems(undefined)).toEqual([]);
    const first = mujahadaIndex(3, '2026-11-02', 0);
    expect(mujahadaIndex(3, '2026-11-02', 125)).toBe((first + 1) % 3);
    expect(mujahadaIndex(0, '2026-11-02', 0)).toBe(-1);
  });
});
