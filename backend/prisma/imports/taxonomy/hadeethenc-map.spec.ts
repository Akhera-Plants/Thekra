import { join } from 'node:path';
import {
  highConfidenceRows,
  loadHadeethencMap,
  parseHadeethencMap,
  validateHadeethencMapTopics,
} from './hadeethenc-map.js';
import { loadTaxonomy, topicBySlug } from './yaml.js';

const TAXONOMY = join(import.meta.dirname, '..', '..', 'taxonomy', 'taxonomy.yaml');
const HEADER = 'id\ttitle\ttopics\tconfidence\treason';

describe('hadeethenc-map', () => {
  it('loads the reviewer decisions (1454 rows, 175 applied high rows)', () => {
    const rows = loadHadeethencMap();
    expect(rows).toHaveLength(1454);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(highConfidenceRows(rows)).toHaveLength(175);
    expect(rows.find((row) => row.id === '8402')).toMatchObject({ confidence: 'high', topics: ['dhikr'] });
    // A high row with no topics is a deliberate "no link" decision.
    expect(rows.find((row) => row.id === '10842')).toMatchObject({ confidence: 'high', topics: [] });
  });

  it('names only known taxonomy slugs on applied rows', () => {
    const topics = topicBySlug(loadTaxonomy(TAXONOMY).topics);
    expect(() => validateHadeethencMapTopics(loadHadeethencMap(), topics)).not.toThrow();
  });

  it('throws on an unknown slug in a high row', () => {
    const rows = parseHadeethencMap(`${HEADER}\n1\tنص\tno-such-slug\thigh\tسبب\n`);
    const topics = topicBySlug(loadTaxonomy(TAXONOMY).topics);
    expect(() => validateHadeethencMapTopics(rows, topics)).toThrow(/unknown slug no-such-slug/);
  });

  it('ignores an unknown slug on a low row', () => {
    const rows = parseHadeethencMap(`${HEADER}\n1\tنص\tno-such-slug\tlow\tسبب\n`);
    expect(() => validateHadeethencMapTopics(rows, new Map())).not.toThrow();
  });

  it('rejects a bad confidence and an empty file', () => {
    expect(() => parseHadeethencMap(`${HEADER}\n1\tنص\tdhikr\tmaybe\tسبب\n`)).toThrow(/bad confidence/);
    expect(() => parseHadeethencMap(`${HEADER}\n`)).toThrow(/no rows/);
  });
});
