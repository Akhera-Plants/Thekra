import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { buildHomeMoments, readHomeMomentsSeed } from './home-moments-yaml.js';
import { HomeMomentsService } from './home-moments.service.js';

const TAXONOMY = join(import.meta.dirname, '..', '..', '..', 'prisma', 'taxonomy');

describe('home-moments.yaml', () => {
  const seeds = readHomeMomentsSeed();

  it('seeds the four moments the web and the app showed before, on the same topics', () => {
    expect(seeds.map((s) => [s.key, s.topicType, s.topicSlug])).toEqual([
      ['anger', 'SIN', 'ghadab'],
      ['prayer', 'GOOD_DEED', 'salah'],
      ['backbiting', 'SIN', 'ghibah'],
      ['kindness', 'GOOD_DEED', 'kalam-tayyib'],
    ]);
  });

  it('phrases every Arabic label as help («تعينك على …»), never as an order or a blame', () => {
    for (const seed of seeds) expect(seed.labelAr).toMatch(/^تعينك على /);
  });

  it('every topic slug exists in taxonomy.yaml on the right side', () => {
    const taxonomy = readFileSync(join(TAXONOMY, 'taxonomy.yaml'), 'utf8');
    for (const seed of seeds.filter((s) => s.topicType !== 'BRANCH')) {
      const side = seed.topicType === 'SIN' ? 'AVOID' : 'DO';
      expect(taxonomy).toMatch(new RegExp(`slug: ${seed.topicSlug}, [^\\n]*side: ${side}`));
    }
  });

  it('refuses unknown fields, a bad topic, a duplicate key, a long label and a bad branch number', () => {
    const one = (extra: string) => `moments:\n  - key: a\n    topic: sin\n    slug: ghadab\n    labelAr: تعينك\n    labelEn: Help\n    icon: pause\n${extra}`;
    expect(() => buildHomeMoments(one('    colour: red\n'))).toThrow(/unknown field "colour"/);
    expect(() => buildHomeMoments(one('').replace('topic: sin', 'topic: person'))).toThrow(/topic must be/);
    expect(() => buildHomeMoments(one('') + one('').replace('moments:\n', ''))).toThrow(/appears twice/);
    expect(() => buildHomeMoments(one('').replace('labelEn: Help', `labelEn: ${'x'.repeat(121)}`))).toThrow(/labelEn/);
    expect(() => buildHomeMoments(one('').replace('topic: sin\n    slug: ghadab', 'topic: branch\n    slug: 0'))).toThrow(/branch number/);
    expect(buildHomeMoments(one('').replace('topic: sin\n    slug: ghadab', 'topic: branch\n    slug: 12'))[0]).toMatchObject({ topicType: 'BRANCH', topicSlug: '12', published: true, situationAr: null });
  });
});

describe('HomeMomentsService.findPublic', () => {
  function setup(rows: unknown[] = []) {
    const prisma = {
      homeMoment: { findMany: vi.fn().mockResolvedValue(rows) },
      sin: {
        findMany: vi.fn().mockResolvedValue([
          { slug: 'ghadab', name: 'Anger', nameAr: 'الغضب', origin: 'TAXONOMY', isHidden: false },
          { slug: 'ghibah', name: 'Backbiting', nameAr: 'الغيبة', origin: 'TAXONOMY', isHidden: true },
        ]),
      },
      goodDeed: { findMany: vi.fn().mockResolvedValue([{ slug: 'salah', name: 'Prayer', nameAr: 'الصلاة', origin: 'TAXONOMY', isHidden: false }]) },
      imanBranch: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return { prisma, service: new HomeMomentsService(prisma as unknown as PrismaService) };
  }

  it('serves the seed while the table is empty, drops missing or hidden topics, in order', async () => {
    const { service } = setup();
    const result = await service.findPublic('ar');
    expect(result.meta).toEqual({ locale: 'ar', source: 'seed' });
    expect(result.data).toEqual([
      {
        key: 'anger',
        label: 'تعينك على التخفّف من الغضب',
        situation: 'قبل أن تردّ وأنت غاضب',
        icon: 'pause',
        topic: { type: 'sin', slug: 'ghadab', title: 'الغضب', path: '/sins/ghadab' },
      },
      expect.objectContaining({ key: 'prayer', topic: { type: 'good-deed', slug: 'salah', title: 'الصلاة', path: '/good-deeds/salah' } }),
    ]);
  });

  it('serves the table when it has rows: unpublished rows stay out; English labels for lang=en', async () => {
    const row = (key: string, published: boolean) => ({
      key, topicType: 'SIN', topicSlug: 'ghadab', labelAr: 'تعينك', labelEn: `Help ${key}`, situationAr: null, situationEn: null, icon: 'pause', sortOrder: 0, published,
    });
    const { service, prisma } = setup([row('a', true), row('b', false)]);
    const result = await service.findPublic('en');
    expect(result.meta.source).toBe('database');
    expect(result.data.map((m) => [m.key, m.label, m.topic.title])).toEqual([['a', 'Help a', 'Anger']]);
    expect(prisma.goodDeed.findMany).not.toHaveBeenCalled();
  });
});
