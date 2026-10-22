import { join } from 'node:path';
import { loadDunyaMap, parseDunyaMap, validateDunyaMapTopics } from './ibn-abi-dunya-map.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

const TAXONOMY = join(import.meta.dirname, '..', '..', 'taxonomy', 'taxonomy.yaml');

describe('ibn-abi-dunya-map', () => {
  it('loads the reviewer chapters (131 rows across the mapped works)', () => {
    const rows = loadDunyaMap();
    expect(rows).toHaveLength(131);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows.every((row) => row.book === 'ibn-abi-dunya')).toBe(true);
    expect(rows.filter((row) => row.work === 'Ciyal')).toHaveLength(22);
    expect(rows.find((row) => row.id === '8b947075-dc1b-4d46-ae95-a4745138ff59')).toMatchObject({
      work: 'Ciyal',
      title: 'باب النفقة على العيال والثواب على النفقة عليهم',
      topics: ['nafaqa-ahl'],
    });
    expect(rows.find((row) => row.id === '8053eeb2-48d5-48c9-9805-2a35fedfb4e7')).toMatchObject({
      work: 'Warac',
      topics: ['wara'],
    });
  });

  it('names only known taxonomy slugs', () => {
    const topics = topicBySlug(loadTaxonomy(TAXONOMY).topics);
    expect(() => validateDunyaMapTopics(loadDunyaMap(), topics)).not.toThrow();
  });

  it('throws on an unknown slug', () => {
    const rows = parseDunyaMap(
      'sections:\n  - { id: a, book: ibn-abi-dunya, work: Ciyal, title: "باب", topics: [no-such-slug] }\n',
    );
    const topics = topicBySlug(loadTaxonomy(TAXONOMY).topics);
    expect(() => validateDunyaMapTopics(rows, topics)).toThrow(/unknown slug no-such-slug/);
  });

  it('rejects an empty map and a bad book', () => {
    expect(() => parseDunyaMap('sections:\n')).toThrow(/no sections/);
    expect(() => parseDunyaMap(
      'sections:\n  - { id: a, book: bukhari, work: Ciyal, title: "باب", topics: [wara] }\n',
    )).toThrow(/bad book/);
  });
});
