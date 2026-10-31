import { allTopicPairs, isPairedSlug, pairForSlug, resetTopicPairsCache, topicBranches } from './topic-pairs.js';

describe('topic pairs', () => {
  beforeEach(() => {
    resetTopicPairsCache();
  });

  it('loads 42 pairs and resolves the prayer title', () => {
    expect(allTopicPairs()).toHaveLength(42);
    expect(pairForSlug('tark-as-salah')).toMatchObject({
      avoid: 'tark-as-salah',
      do: 'salah',
      titleAr: 'الصلاة',
      titleEn: 'Guarding the prayers',
    });
    expect(pairForSlug('salah')?.titleAr).toBe('الصلاة');
    expect(isPairedSlug('adab-salah')).toBe(false);
  });

  it('reads each topic\'s branches of faith', () => {
    expect(topicBranches('ghibah')).toEqual([34, 44]);
    expect(topicBranches('riya')).toEqual([45]);
    expect(topicBranches('ghadab')).toEqual([]);
    expect(topicBranches('no-such-topic')).toEqual([]);
  });
});
