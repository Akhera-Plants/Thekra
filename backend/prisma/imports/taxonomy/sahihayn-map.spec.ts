import { loadSahihaynMap, parseSahihaynMap } from './sahihayn-map.js';

describe('sahihayn-map', () => {
  it('loads the reviewer chapters (batch 1 prayer + batch 2 all topics)', () => {
    const rows = loadSahihaynMap();
    expect(rows).toHaveLength(662);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows.filter((row) => row.topics.includes('tark-as-salah'))).toHaveLength(9);
    expect(rows.find((row) => row.id === 'f2507e24-a631-4277-9897-f857eff3a740')).toMatchObject({
      book: 'muslim',
      topics: ['tark-as-salah'],
    });
    expect(rows.find((row) => row.id === '789a720e-e384-4be6-b62d-98028db81088')).toMatchObject({
      book: 'bukhari',
      topics: ['salah'],
    });
  });

  it('rejects an empty map', () => {
    expect(() => parseSahihaynMap('sections:\n')).toThrow(/no sections/);
  });
});
