import { join } from 'node:path';
import { loadSahihaynHadithMap, parseSahihaynHadithMap, validateSahihaynHadithMap } from './sahihayn-hadith-map.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

const header = 'quoteId\tbook\tnumber\tbab\ttargets\tconfidence\treason\n';

describe('sahihayn-hadith-map', () => {
  it('loads exactly 566 high-confidence rows with valid targets', () => {
    const rows = loadSahihaynHadithMap();
    expect(rows).toHaveLength(566);
    const topics = topicBySlug(loadTaxonomy(join(import.meta.dirname, '..', '..', 'taxonomy', 'taxonomy.yaml')).topics);
    expect(() => validateSahihaynHadithMap(rows, topics, new Set(Array.from({ length: 77 }, (_, index) => index + 1)))).not.toThrow();
  });

  it('ignores low-confidence and unclassified rows', () => {
    expect(parseSahihaynHadithMap(`${header}a\tBUKHARI\t1\tباب\ttopic:unknown\tlow\t\nb\tMUSLIM\t2\tباب\t\t\t`)).toEqual([]);
  });

  it('rejects unknown slugs and branches', () => {
    const topic = parseSahihaynHadithMap(`${header}a\tBUKHARI\t1\tباب\ttopic:unknown\thigh\t`);
    expect(() => validateSahihaynHadithMap(topic, new Map(), new Set())).toThrow(/Unknown slug/);
    const branch = parseSahihaynHadithMap(`${header}a\tMUSLIM\t1\tباب\tbranch:999\thigh\t`);
    expect(() => validateSahihaynHadithMap(branch, new Map(), new Set([1]))).toThrow(/Unknown branch/);
  });
});
