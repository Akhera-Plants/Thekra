import { existsSync, readFileSync } from 'node:fs';
import { validateRule } from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import { pickHabits } from '../scripts/gen-catalog.mjs';
import { buildManifest, GECKO_ID } from '../scripts/manifest.mjs';
import { parseMiniYaml } from '../scripts/mini-yaml.mjs';
import { evidenceIsFresh, fetchEvidence, DAY_MS, type FetchLike } from '../src/cache.js';
import { deedUrl, parseCatalog } from '../src/catalog.js';

/** Present inside the Thekra monorepo; skipped once the extension lives in its own repository. */
const YAML_PATH = new URL('../../backend/prisma/taxonomy/deed-schedules.yaml', import.meta.url);

describe('mini-yaml', () => {
  it('reads the flow-style subset used by the catalog', () => {
    const text = [
      '# comment',
      'habits:',
      '  - key: duha',
      "    titleEn: two rak'ahs # trailing comment",
      '    start: { far: 1, near: 1 }',
      "    defaultSlots: ['09:30', \"11:00\"]",
      "    rule: { kind: everyNWeeks, n: 1, weekday: 5, anchor: '2026-10-30' }",
      '    titleAr: «سبحان الله وبحمده» صباحًا (13 و14)',
      '    flag: true',
      '',
      'other:',
      '- 1',
      "- 'it''s'",
    ].join('\n');
    expect(parseMiniYaml(text)).toEqual({
      habits: [
        {
          key: 'duha',
          titleEn: "two rak'ahs",
          start: { far: 1, near: 1 },
          defaultSlots: ['09:30', '11:00'],
          rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' },
          titleAr: '«سبحان الله وبحمده» صباحًا (13 و14)',
          flag: true,
        },
      ],
      other: [1, "it's"],
    });
  });

  it('refuses YAML it does not support instead of guessing', () => {
    expect(() => parseMiniYaml('a: &anchor 1')).toThrow(/unsupported/);
    expect(() => parseMiniYaml('a: 1\na: 2')).toThrow(/duplicate/);
    expect(() => parseMiniYaml('a: [1, 2')).toThrow();
    expect(() => parseMiniYaml('a: b: c')).toThrow();
    expect(() => parseMiniYaml('a:\n\t- 1')).toThrow(/tabs/);
  });

  it.skipIf(!existsSync(YAML_PATH))('parses deed-schedules.yaml into a fully valid catalog', () => {
    const raw = parseMiniYaml(readFileSync(YAML_PATH, 'utf8'));
    const picked = pickHabits(raw);
    const habits = parseCatalog({ habits: picked });
    expect(habits.length).toBe(picked.length);
    expect(habits.length).toBeGreaterThan(0);
    for (const h of habits) {
      expect(validateRule(h.defaultRule)).toBeNull();
      expect(h.evidence.length).toBeGreaterThan(0);
    }
    // The optional prayer suggestions pass through to the bundled catalog.
    expect(picked.find((h: { key: string }) => h.key === 'witr')?.defaultAnchors).toEqual([{ prayer: 'isha', offset: 60 }]);
  });
});

describe('catalog', () => {
  const habit = {
    key: 'quran-wird',
    titleAr: 'ورد القرآن',
    titleEn: 'Daily Quran reading',
    deed: 'quran',
    unit: 'minutes',
    unitLabelAr: 'دقيقة',
    unitLabelEn: 'minutes',
    start: { far: 2, near: 10 },
    defaultRule: { kind: 'daily' },
    defaultSlots: ['21:00', '06:00'],
    basis: 'organizational',
    evidence: ['98e68a75-d3d2-4a38-8da1-5772564adf8d'],
  };

  it('reads the API envelope and ignores sin programs and occasions', () => {
    const habits = parseCatalog({ data: { habits: [habit], occasions: [{ key: 'x' }], sinPrograms: [{ key: 'secret' }] } });
    expect(habits).toHaveLength(1);
    expect(habits[0]?.defaultSlots).toEqual(['06:00', '21:00']);
    expect(JSON.stringify(habits)).not.toContain('secret');
  });

  it('drops malformed habits and duplicates', () => {
    const bad = [
      { ...habit, key: 'Bad Key' },
      { ...habit, key: 'b', deed: '../x' },
      { ...habit, key: 'c', defaultRule: { kind: 'weekdays', days: [9] } },
      { ...habit, key: 'd', defaultSlots: ['25:00'] },
      { ...habit, key: 'e', evidence: ['nope'] },
      { ...habit, key: 'f', basis: 'other' },
      habit,
      habit,
    ];
    expect(parseCatalog({ habits: bad }).map((h) => h.key)).toEqual(['quran-wird']);
  });

  it('links to the deed page in the chosen language', () => {
    expect(deedUrl('quran', 'ar')).toBe('https://thekra-web.vercel.app/good-deeds/quran');
    expect(deedUrl('quran', 'en')).toBe('https://thekra-web.vercel.app/en/good-deeds/quran');
    expect(() => deedUrl('a/b', 'ar')).toThrow();
  });
});

describe('evidence cache', () => {
  const A = '98e68a75-d3d2-4a38-8da1-5772564adf8d';
  const B = 'c2bdf702-6809-4474-a5fc-8b62439233ce';
  const quote = (id: string) => ({ id, type: 'HADITH', textAr: 'نص', hadith: { reference: 'صحيح مسلم 1' }, isAthar: false });

  it('keeps only requested ids and remembers what was asked', async () => {
    const urls: string[] = [];
    const fake: FetchLike = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => ({ data: [quote(A), quote('11111111-1111-1111-1111-111111111111')] }) };
    };
    const cache = await fetchEvidence(fake, [B, A, A], 1000, 'en');
    expect(urls).toEqual([`https://thekra.vercel.app/v1/practice/evidence?ids=${A},${B}&lang=en`]);
    expect(Object.keys(cache.quotes)).toEqual([A]);
    expect(cache.ids).toEqual([A, B]);
    expect(evidenceIsFresh(cache, [A, B], 1000 + DAY_MS - 1, 'en')).toBe(true);
    expect(evidenceIsFresh(cache, [A, B], 2000, 'ar')).toBe(false);
    expect(evidenceIsFresh(cache, [A, B], 1000 + DAY_MS, 'en')).toBe(false);
    expect(evidenceIsFresh(cache, ['98e68a75-d3d2-4a38-8da1-000000000000'], 2000, 'en')).toBe(false);
  });

  it('throws on a failed answer so the previous cache is kept', async () => {
    const fail: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchEvidence(fail, [A], 0, 'ar')).rejects.toThrow(/503/);
  });
});

describe('manifests', () => {
  for (const target of ['chrome', 'firefox'] as const) {
    it(`${target}: only alarms, notifications, storage and the API host`, () => {
      const m = JSON.parse(JSON.stringify(buildManifest(target, '0.1.0'))) as Record<string, unknown>;
      expect(m.manifest_version).toBe(3);
      expect(m.permissions).toEqual(['alarms', 'notifications', 'storage']);
      expect(m.host_permissions).toEqual(['https://thekra.vercel.app/*']);
      for (const key of ['content_scripts', 'optional_permissions', 'content_security_policy', 'web_accessible_resources']) expect(m).not.toHaveProperty(key);
    });
  }

  it('firefox carries the gecko id and background scripts', () => {
    const m = buildManifest('firefox', '0.1.0') as { background: unknown; browser_specific_settings: { gecko: { id: string } } };
    expect(m.browser_specific_settings.gecko.id).toBe(GECKO_ID);
    expect(m.background).toEqual({ scripts: ['background.js'] });
  });
});
