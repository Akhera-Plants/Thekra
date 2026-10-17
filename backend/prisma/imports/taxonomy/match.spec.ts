import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ordinalInTitle } from './ordinal.js';
import { norm } from './norm.js';
import {
  coverage,
  coverageDiff,
  keywordSide,
  matchKeywords,
  withKabiraNumbers,
  type MatchSection,
} from './match.js';
import { loadTaxonomy, parseTaxonomy, type Topic } from './yaml.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const DOCS = join(ROOT, 'docs', 'taxonomy');
const BOOKS = ['riyad', 'targhib', 'zuhd', 'minhaj', 'kabair', 'munajjid', 'adab', 'bukhari', 'muslim'] as const;

function loadSections(): MatchSection[] {
  const sections: MatchSection[] = [];
  for (const book of BOOKS) {
    const lines = readFileSync(join(DOCS, 'sections', `${book}.tsv`), 'utf8').split('\n').slice(1);
    let order = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const [id, parentPath, level, number, titleAr, ayah, hadith, author] = line.split('\t');
      order += 1;
      sections.push({
        id: id ?? '',
        book,
        level: level ?? '',
        number: number || null,
        titleAr: titleAr ?? '',
        parentPath: parentPath ?? '',
        ayah: Number(ayah ?? 0),
        hadith: Number(hadith ?? 0),
        author: Number(author ?? 0),
        kabiraNumber: null,
        order,
      });
    }
  }
  return withKabiraNumbers(sections);
}

function ids(path: string, column: number): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.split('\t')[column] ?? '');
}

describe('taxonomy norm', () => {
  it('folds persian letters and drops diacritics', () => {
    expect(norm('یا کافر')).toBe('يا كافر');
    expect(norm('فَخْرُ الأَرْضِ')).toBe('فخر الارض');
    expect(norm('صَدَقَة')).toBe('صدقه');
  });
});

describe('kabira ordinals', () => {
  it('reads this edition, including عشر and الحاديثة', () => {
    const sections = loadSections().filter((section) => section.book === 'kabair' && section.level === 'KABIRA');
    const missing = new Set([35, 38, 64]);
    const expected: number[] = [];
    for (let number = 1; number <= 70; number += 1) if (!missing.has(number)) expected.push(number);
    expect(sections.map((section) => ordinalInTitle(section.titleAr))).toEqual(expected);
  });
});

describe('taxonomy yaml', () => {
  const taxonomy = loadTaxonomy(join(ROOT, 'backend', 'prisma', 'taxonomy', 'taxonomy.yaml'));

  it('applies every topic and keeps opposites cross-side', () => {
    expect(taxonomy.domains).toHaveLength(12);
    expect(taxonomy.topics).toHaveLength(166);
    expect(taxonomy.topics.filter((topic) => topic.side === 'AVOID')).toHaveLength(86);
    expect(taxonomy.topics.filter((topic) => topic.side === 'DO')).toHaveLength(80);
    expect(taxonomy.akhlaq).toHaveLength(10);
    expect(taxonomy.pairs).toHaveLength(41);
    expect(taxonomy.topics.find((topic) => topic.slug === 'adab-salah')?.ar).toBe('الخشوع وآداب الصلاة');
    expect(taxonomy.pairs.find((pair) => pair.avoid === 'tark-as-salah')).toMatchObject({
      do: 'salah',
      ar: 'الصلاة',
    });

    const ghadr = taxonomy.topics.find((topic) => topic.slug === 'ghadr');
    expect(ghadr?.riyadPhrases).toEqual(['تحريم الغدر']);
    const tasweer = taxonomy.topics.find((topic) => topic.slug === 'tasweer');
    expect(tasweer).toMatchObject({ hidden: true, kabair: [48] });
    const tark = taxonomy.topics.find((topic) => topic.slug === 'tark-lillah');
    expect(tark?.listed).toBe(false);
    expect(taxonomy.topics.find((topic) => topic.slug === 'salamat-sadr')?.sideCheck).toBe(false);
    expect(taxonomy.topics.find((topic) => topic.slug === 'waqt-tawasul')?.derivedFrom).toEqual(['idaat-al-waqt', 'nazar-muharram', 'ghibah']);
  });

  it('keeps a comma inside an English name', () => {
    const text = readFileSync(join(ROOT, 'backend', 'prisma', 'taxonomy', 'taxonomy.yaml'), 'utf8');
    const topic = parseTaxonomy(text).topics.find((row) => row.slug === 'amn-makr');
    expect(topic?.en).toBe("Feeling safe from Allah's plan, or despairing of His mercy");
  });
});

describe('anchor coverage', () => {
  const taxonomy = loadTaxonomy(join(ROOT, 'backend', 'prisma', 'taxonomy', 'taxonomy.yaml'));
  const sections = loadSections();
  const report = coverage(taxonomy.topics, sections);

  it('matches the reviewer dry run', () => {
    const title = new Map(sections.map((section) => [section.id, `${section.book} ${section.titleAr}`]));
    const expectedIds = new Set(ids(join(DOCS, 'unmapped-sections.tsv'), 1));
    const actualIds = new Set(report.unmappedIds);
    const extra = [...actualIds].filter((id) => !expectedIds.has(id)).map((id) => title.get(id));
    // riyad 44 and 80 were added to the YAML after the unmapped list. «یا کافر» is the Persian-yeh example.
    const explained = [...expectedIds].filter((id) => !actualIds.has(id)).map((id) => title.get(id));
    expect({ diff: coverageDiff(report), extraUnmapped: extra, explained }).toEqual({
      diff: [],
      extraUnmapped: [],
      explained: [
        'riyad باب توقير العلماء والكبار وأهل الفضل وتقديمهم على غيرهم ورفع مجالسهم وإظهار مرتبتهم',
        'riyad باب وجوب طاعة ولاة الأمر في غير معصية وتحريم طاعتهم في المعصية',
        'targhib الترهيب من قوله لمسلم : یا کافر !',
      ],
    });
  });
});

describe('keyword side', () => {
  const topics = [{ slug: 'ghibah', side: 'AVOID', kw: ['الغيبة'] }, { slug: 'dhikr', side: 'DO', kw: ['الذكر'] }] as Topic[];

  it('reads the title verb and lets a title with no verb match either side', () => {
    expect(keywordSide('باب تحريم الغيبة')).toBe('AVOID');
    expect(keywordSide('باب فضل الذكر')).toBe('DO');
    expect(keywordSide('باب ما جاء في الذكر')).toBe('EITHER');
    const section = {
      id: '1', book: 'bukhari' as const, level: 'BAB', number: null, titleAr: 'باب فضل الذكر', parentPath: '',
      ayah: 0, hadith: 1, author: 0, kabiraNumber: null, order: 1,
    };
    expect(matchKeywords(section, topics)).toEqual(['dhikr']);
  });
});
