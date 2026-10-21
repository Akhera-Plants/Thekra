import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTopicThemes, topicThemesPath } from '../../../src/modules/taxonomy/topic-themes.js';
import { keysForLink, loadThemesFile, themesByTopic } from './themes.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

describe('topic-themes.yaml', () => {
  const taxonomy = loadTaxonomy(join(process.cwd(), 'prisma', 'taxonomy', 'taxonomy.yaml'));
  const topics = topicBySlug(taxonomy.topics);
  const themes = loadThemesFile(topics);

  it('parses, names only known topics and keeps keys unique', () => {
    expect(themes.length).toBeGreaterThan(100);
    expect(new Set(themes.map((theme) => theme.key)).size).toBe(themes.length);
    expect(parseTopicThemes(readFileSync(topicThemesPath(), 'utf8'))).toHaveLength(themes.length);
  });

  it('keeps labels short: 2–5 words (ﷺ not counted)', () => {
    for (const theme of themes) {
      const words = theme.ar.split(/\s+/).filter((word) => word !== 'ﷺ').length;
      expect(words, theme.key).toBeGreaterThanOrEqual(2);
      expect(words, theme.key).toBeLessThanOrEqual(5);
    }
  });

  it('tags the tark-as-salah chapters named in the brief', () => {
    const index = themesByTopic(themes);
    const keys = (note: string, sectionTitle: string | null = null, parentTitles: string[] = []) =>
      keysForLink({ slug: 'tark-as-salah', note, sectionTitle, parentTitles }, index);
    expect(keys('من باب: الترهيب من ترك الصلاة تعمداً — صحيح الترغيب والترهيب')).toEqual(['tark-salah-iqab']);
    expect(keys('من باب: فصل — الكبائر', 'فصل', ['الكبيرة الرابعة في ترك الصلاة'])).toEqual(['tark-salah-iqab']);
    expect(keys('من باب: الترهيب من ترك الجمعة لغير عذر — صحيح الترغيب والترهيب')).toEqual(['tark-jumua']);
    expect(keys('من باب: الترهيب من ترك حضور الجماعة — صحيح الترغيب والترهيب')).toEqual(['tark-jamaah']);
    expect(keys('من باب: باب إثم من فاتته العصر — صحيح البخاري')).toEqual(['tark-asr']);
    expect(keys('من باب: باب بيان إطلاق اسم الكفر على من ترك الصلاة ) — صحيح مسلم')).toEqual(['tark-salah-iqab']);
    expect(keys('The five prayers as expiations — underscores their weight.')).toEqual([]);
  });

  it('only gives a link the themes of its own topic', () => {
    const index = themesByTopic(themes);
    expect(keysForLink({ slug: 'ghibah', note: 'من باب: الترهيب من ترك الجمعة لغير عذر — صحيح الترغيب والترهيب', sectionTitle: null, parentTitles: [] }, index)).toEqual([]);
  });
});
