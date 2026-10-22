import { tmpdir } from 'node:os';
import { pairForSlug, resetTopicPairsCache } from './topic-pairs.js';
import { resetTopicThemesCache, themesForTopics } from './topic-themes.js';

// The reviewer files resolve from the module, not process.cwd(): on Vercel the
// cwd is /var/task, which holds no prisma/ folder. (The bundle embeds the files
// instead; scripts/gate-vercel.mjs checks that path.)
describe('taxonomy files', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    process.chdir(tmpdir());
    resetTopicPairsCache();
    resetTopicThemesCache();
  });

  afterEach(() => {
    process.chdir(cwd);
    resetTopicPairsCache();
    resetTopicThemesCache();
  });

  it('loads pairs and themes when the cwd is not backend/', () => {
    expect(pairForSlug('tark-as-salah')?.do).toBe('salah');
    expect(themesForTopics(['tark-as-salah']).length).toBeGreaterThan(0);
  });
});
