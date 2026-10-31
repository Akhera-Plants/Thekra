import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { MURAQABA_QUOTE_IDS, STORY_MOMENTS } from '@thekra/practice-core';
import { taxonomyFilePath } from '../taxonomy/taxonomy-files.js';
import { buildHeartTexts, heartTexts, isMizanKey, mizanIdsFor } from './heart-texts.js';

const text = readFileSync(taxonomyFilePath('heart-texts.yaml'), 'utf8');
const reviewedIds = new Set(
  ['deed-schedules.yaml', 'sin-programs.yaml'].flatMap(
    (file) => readFileSync(taxonomyFilePath(file as 'deed-schedules.yaml'), 'utf8').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [],
  ),
);

describe('heart-texts.yaml — the real reviewer file', () => {
  const cwd = process.cwd();
  beforeAll(() => process.chdir(tmpdir()));
  afterAll(() => process.chdir(cwd));

  it('loads, is pending the sheikh, and has exactly the practice-core story keys', () => {
    const file = heartTexts();
    expect(file.review).toBe('pending-sheikh');
    expect(Object.keys(file.stories).sort()).toEqual(Object.values(STORY_MOMENTS).sort());
  });

  it('never invents an id: every id is already in a reviewed file or carries a `# checked:` note', () => {
    const file = heartTexts();
    const ids = [...Object.values(file.mizan).flat(), ...Object.values(file.stories).filter((id): id is string => id !== null)];
    for (const id of ids) {
      const line = text.split('\n').find((l) => l.includes(id)) ?? '';
      expect(reviewedIds.has(id) || MURAQABA_QUOTE_IDS.includes(id) || /# checked:/.test(line), id).toBe(true);
    }
  });

  it('a topic without curated ids has none (the API falls back to its top text)', () => {
    expect(mizanIdsFor('no-such-topic')).toEqual([]);
    expect(mizanIdsFor(999)).toEqual([]);
  });
});

describe('heart-texts.yaml — validation', () => {
  const stories = 'stories:\n  qatil-al-mia:\n  marad-safar:\n  fasila:\n  ghusn-shawk:\n';
  const id = '0d77e977-f40b-473b-8b14-42b5fb82951a';

  it('accepts curated topic and branch keys with up to two ids', () => {
    const file = buildHeartTexts(`review: x\nmizan:\n  siyam: [${id}]\n  branch-7: [${id}, 93f7d1ab-b6f7-4521-bae8-f37cc1ff06a2]\n${stories}`);
    expect(file.mizan).toEqual({ siyam: [id], 'branch-7': [id, '93f7d1ab-b6f7-4521-bae8-f37cc1ff06a2'] });
    expect(Object.values(file.stories)).toEqual([null, null, null, null]);
  });

  it('rejects unknown topics, branch numbers out of range, bad or too many ids', () => {
    expect(isMizanKey('ghibah')).toBe(true);
    expect(isMizanKey('branch-78')).toBe(false);
    expect(() => buildHeartTexts(`review: x\nmizan:\n  nope: [${id}]\n${stories}`)).toThrow('is not a taxonomy.yaml topic');
    expect(() => buildHeartTexts(`review: x\nmizan:\n  branch-0: [${id}]\n${stories}`)).toThrow('branch-1');
    expect(() => buildHeartTexts(`review: x\nmizan:\n  siyam: [x]\n${stories}`)).toThrow('is not a UUID');
    expect(() => buildHeartTexts(`review: x\nmizan:\n  siyam: [${id}, ${id}]\n${stories}`)).toThrow('lists an id twice');
    expect(() => buildHeartTexts(`review: x\nmizan:\n  siyam: [${id}, ${id}, ${id}]\n${stories}`)).toThrow('1 to 2');
    expect(() => buildHeartTexts(`review: x\nmizan:\n  siyam: []\n${stories}`)).toThrow('1 to 2');
  });

  it('rejects a missing or unknown story key, and a story value that is not a UUID', () => {
    expect(() => buildHeartTexts('review: x\nstories:\n  qatil-al-mia:\n')).toThrow('"marad-safar" is missing');
    expect(() => buildHeartTexts(`review: x\n${stories}  other:\n`)).toThrow('"other" is not a practice-core story key');
    expect(() => buildHeartTexts(`review: x\n${stories.replace('fasila:', 'fasila: abc')}`)).toThrow('not a UUID or empty');
    expect(buildHeartTexts(`review: x\n${stories.replace('fasila:', `fasila: ${id}`)}`).stories['fasila']).toBe(id);
  });

  it('rejects an unknown top-level field and a missing review', () => {
    expect(() => buildHeartTexts(`review: x\nnote: y\n${stories}`)).toThrow('unknown field "note"');
    expect(() => buildHeartTexts(stories)).toThrow('review must be');
  });
});
