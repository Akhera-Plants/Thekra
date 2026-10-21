import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAdhkarMap, parseAdhkarMap, validateAdhkarMapTopics } from './adhkar-map.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

const topics = topicBySlug(loadTaxonomy(join(import.meta.dirname, '..', '..', 'taxonomy', 'taxonomy.yaml')).topics);

describe('adhkar-map', () => {
  it('loads 194 unique eligible chapters with exact source titles and allowed topics', () => {
    const rows = loadAdhkarMap();
    expect(rows).toHaveLength(194);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    const sections = new Map(readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'sections', 'adhkar.tsv'), 'utf8')
      .trimEnd().split('\n').slice(1).map((line) => { const fields = line.split('\t'); return [fields[0], fields]; }));
    for (const row of rows) {
      const fields = sections.get(row.id);
      expect(fields).toBeDefined();
      expect(['BAB', 'FASL']).toContain(fields?.[2]);
      expect(Number(fields?.[6])).toBeGreaterThan(0);
      expect(fields?.[4]).toBe(row.title);
    }
    expect(() => validateAdhkarMapTopics(rows, topics)).not.toThrow();
  });

  it('rejects unknown and disallowed topics and duplicate ids', () => {
    const row = { id: 'a', book: 'nawawi-adhkar' as const, title: 'باب', topics: ['unknown'] };
    expect(() => validateAdhkarMapTopics([row], topics)).toThrow(/unknown slug/);
    const dhikr = topics.get('dhikr');
    if (!dhikr) throw new Error('Missing dhikr fixture');
    expect(() => validateAdhkarMapTopics([{ ...row, topics: ['dhikr'] }], new Map([['dhikr', { ...dhikr, hidden: true }]]))).toThrow(/disallowed/);
    const text = '- { id: a, book: nawawi-adhkar, title: باب, topics: [dhikr] }';
    expect(() => parseAdhkarMap(`${text}\n${text}`)).toThrow(/Duplicate/);
  });
});
