import { tmpdir } from 'node:os';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { buildNamesOfAllah, NAME_ACTIONS, nameOfAllahBySlug, namesOfAllah, nameWordPattern } from './names-of-allah.js';

const entry = (over: Record<string, string> = {}) => {
  const fields = {
    name: 'التواب',
    slug: 'at-tawwab',
    ref: "'2:37'",
    quoteId: '0d77e977-f40b-473b-8b14-42b5fb82951a',
    meaningAr: 'يقبل التوبة',
    meaningEn: 'Accepts repentance',
    ...over,
  };
  return `  - ${Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n    ')}\n`;
};
const file = (...entries: string[]) => `review: x\nnames:\n${entries.join('')}`;

describe('names-of-allah.yaml — the real reviewer file', () => {
  const cwd = process.cwd();
  beforeAll(() => process.chdir(tmpdir()));
  afterAll(() => process.chdir(cwd));

  it('loads 77 names, pending the sheikh, each with a slug, a ref, a uuid and both meanings', () => {
    const { review, names } = namesOfAllah();
    expect(review).toBe('pending-sheikh');
    expect(names).toHaveLength(77);
    expect(new Set(names.map((n) => n.slug)).size).toBe(77);
    expect(new Set(names.map((n) => normalizeArabic(n.nameAr))).size).toBe(77);
    expect(names.map((n) => n.number)).toEqual(names.map((_, i) => i + 1));
    for (const name of names) {
      expect(name.ref).toBe(`${name.surah}:${name.ayah}`);
      expect(name.meaningAr.length).toBeGreaterThan(5);
      expect(name.meaningEn.length).toBeGreaterThan(5);
    }
  });

  it('keeps the verified refs and quote ids', () => {
    expect(nameOfAllahBySlug('allah')).toMatchObject({ nameAr: 'الله', ref: '59:22', quoteId: '9d794b31-1319-4655-a0b8-364d1fd98260' });
    expect(nameOfAllahBySlug('al-majid')).toMatchObject({ ref: '11:73', quoteId: '6a423a94-52d6-4dad-85b1-5f6638c5a64b' });
  });

  it('links only to taxonomy.yaml topics of the right side, or to a known action', () => {
    const links = namesOfAllah().names.flatMap((n) => n.links);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      if (link.kind === 'deed') expect(topicSide(link.slug), link.slug).toBe('DO');
      else if (link.kind === 'sin') expect(topicSide(link.slug), link.slug).toBe('AVOID');
      else expect(NAME_ACTIONS).toContain(link.slug);
    }
    expect(nameOfAllahBySlug('at-tawwab')?.links).toEqual([
      { kind: 'deed', slug: 'tawba' },
      { kind: 'action', slug: 'leave-sin' },
    ]);
    expect(nameOfAllahBySlug('al-halim')?.links).toContainEqual({ kind: 'sin', slug: 'ghadab' });
  });

  it('never searches «له» for the name of Allah', () => {
    expect(nameOfAllahBySlug('allah')?.bare).toBe(false);
  });
});

describe('names-of-allah.yaml — validation', () => {
  it('accepts a valid entry with optional links and bare', () => {
    const parsed = buildNamesOfAllah(file(entry({ links: "['deed:tawba', 'action:leave-sin']", bare: 'false' })));
    expect(parsed.names[0]).toMatchObject({ number: 1, slug: 'at-tawwab', surah: 2, ayah: 37, bare: false });
    expect(buildNamesOfAllah(file(entry())).names[0]).toMatchObject({ links: [], bare: true });
  });

  it('rejects duplicate names and slugs', () => {
    expect(() => buildNamesOfAllah(file(entry(), entry({ slug: 'other' })))).toThrow('listed twice');
    expect(() => buildNamesOfAllah(file(entry(), entry({ name: 'الغفور' })))).toThrow('slug "at-tawwab" is listed twice');
  });

  it('rejects a bad ref, uuid, slug or name', () => {
    expect(() => buildNamesOfAllah(file(entry({ ref: "'2-37'" })))).toThrow('surah:ayah');
    expect(() => buildNamesOfAllah(file(entry({ ref: "'115:1'" })))).toThrow('surah:ayah');
    expect(() => buildNamesOfAllah(file(entry({ quoteId: 'abc' })))).toThrow('not a UUID');
    expect(() => buildNamesOfAllah(file(entry({ slug: 'At_Tawwab' })))).toThrow('lowercase ASCII');
    expect(() => buildNamesOfAllah(file(entry({ name: 'تواب' })))).toThrow('with «ال»');
  });

  it('rejects links to unknown topics, the wrong side, or unknown actions', () => {
    expect(() => buildNamesOfAllah(file(entry({ links: "['deed:nope']" })))).toThrow('not a good deed');
    expect(() => buildNamesOfAllah(file(entry({ links: "['deed:ghadab']" })))).toThrow('not a good deed');
    expect(() => buildNamesOfAllah(file(entry({ links: "['sin:tawba']" })))).toThrow('not a sin');
    expect(() => buildNamesOfAllah(file(entry({ links: "['action:fly']" })))).toThrow('is not one of');
    expect(() => buildNamesOfAllah(file(entry({ links: "['branch:1']" })))).toThrow('must be deed, sin or action');
  });

  it('rejects unknown fields and a missing meaning', () => {
    expect(() => buildNamesOfAllah(file(entry({ note: 'x' })))).toThrow('unknown field "note"');
    expect(() => buildNamesOfAllah(file(entry({ meaningEn: "''" })))).toThrow('meaningEn must be');
    expect(() => buildNamesOfAllah('names: []\n')).toThrow('review must be');
  });
});

describe('nameWordPattern', () => {
  const matches = (pattern: string, text: string) => new RegExp(pattern, 'u').test(normalizeArabic(text));

  it('matches the word with or without «ال» as a whole word, ignoring tashkeel and alef forms', () => {
    const pattern = nameWordPattern({ nameAr: 'التواب', bare: true });
    expect(matches(pattern, 'إِنَّهُۥ هُوَ ٱلتَّوَّابُ')).toBe(true);
    expect(matches(pattern, 'كان توابا')).toBe(false);
    expect(matches(pattern, 'إنه تواب رحيم')).toBe(true);
    expect(matches(pattern, 'وَالتواب')).toBe(true);
    expect(matches(pattern, 'التوابين')).toBe(false);
  });

  it('with bare: false only the form with «ال» counts', () => {
    const pattern = nameWordPattern({ nameAr: 'الله', bare: false });
    expect(matches(pattern, 'له ما في السماوات')).toBe(false);
    expect(matches(pattern, 'وَٱللَّهُ عَلِيمٌ')).toBe(true);
  });
});
