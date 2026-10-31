import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildReminderSets, readReminderSets } from './reminder-sets-yaml.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const TAXONOMY = join(ROOT, 'backend', 'prisma', 'taxonomy');

function citationFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...citationFiles(path));
    else if (name === 'citations.yaml') out.push(path);
  }
  return out;
}

describe('reminder-sets.yaml', () => {
  const file = readReminderSets();

  it('holds the five starter sets, pending the sheikh', () => {
    expect(file.review).toBe('pending-sheikh');
    expect(file.sets.map((set) => set.titleAr)).toEqual(['آيات الرجاء', 'أذكار الصباح والمساء', 'الصبر عند البلاء', 'قبل النوم', 'التوبة']);
  });

  it('uses only ids that already appear in another reviewed file (no invented id)', () => {
    const reviewed = [
      ...['deed-schedules.yaml', 'sin-programs.yaml', 'heart-texts.yaml'].map((name) => join(TAXONOMY, name)),
      ...citationFiles(join(ROOT, 'docs', 'research')),
    ]
      .map((path) => readFileSync(path, 'utf8').toLowerCase())
      .join('\n');
    for (const set of file.sets) for (const id of set.items) expect(reviewed, `${set.slug}: ${id}`).toContain(id);
  });

  it('rejects malformed files', () => {
    expect(() => buildReminderSets('review: x\nsets: []\n')).toThrow(/non-empty list/);
    expect(() => buildReminderSets('review: x\nsets:\n  - slug: Bad Slug\n    titleAr: a\n    titleEn: b\n    items: []\n')).toThrow(/kebab-case/);
    expect(() =>
      buildReminderSets('review: x\nsets:\n  - slug: a\n    titleAr: a\n    titleEn: b\n    items: [not-a-uuid]\n'),
    ).toThrow(/not a UUID/);
    expect(() => buildReminderSets('review: x\nsets:\n  - slug: a\n    titleAr: a\n    titleEn: b\n    items: []\n    extra: 1\n')).toThrow(/unknown field/);
  });
});
