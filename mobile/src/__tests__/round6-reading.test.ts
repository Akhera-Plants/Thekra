/**
 * Round 6 (docs/plan/2026-11-09-owner-round-6.md): the city in the UI language (C-03a), the strategies' groups and
 * «طبّقها على عادة» (C-18 a), the read filter of topic pages (owner chat), the kind report errors (C-01s), the
 * home moments' safe paths (C-09), the reader's link ids (C-13).
 */

import { createPlan, listedStrategies, STRATEGIES, strategyAppliesToHabit } from '@thekra/practice-core';
import { cityLabel } from '../lib/practice/city-name';
import { appliesToHabit, applySuggestion } from '../lib/practice/strategies';
import { buildTopicSections, filterSectionsByRead } from '../lib/topics';
import { reportErrorKey } from '../lib/share/report-error';
import { isTopicPath } from '../lib/home/moments';
import { inviteAppLink, circleErrorKey } from '../lib/circles/circle-view';
import { ApiError, type QuoteDto, type TopicText } from '../lib/types/api';
import ar from '../lib/i18n/ar.json';

describe('city name (C-03a)', () => {
  it('shows a known city in the UI language and anything else as typed', () => {
    expect(cityLabel('Amman', 'ar')).toBe('عمّان');
    expect(cityLabel('amman, JO', 'ar')).toBe('عمّان');
    expect(cityLabel('عمان', 'en')).toBe('Amman');
    expect(cityLabel('Al Quds', 'ar')).toBe('القدس');
    expect(cityLabel('Mecca', 'ar')).toBe('مكة المكرمة');
    expect(cityLabel('Springfield', 'ar')).toBe('Springfield');
  });
});

describe('strategies (C-18 a)', () => {
  it('uses the families of practice-core (the same as the website): بناء / ترك / عودة', () => {
    for (const s of STRATEGIES) expect(['build', 'leave', 'return']).toContain(s.kind);
    expect(listedStrategies('all').length).toBe(STRATEGIES.length - 1);
    expect(listedStrategies('leave').map((s) => s.key)).toEqual(['block-sin', 'know-weak', 'ride-wave', 'follow-good']);
  });

  it('applies a strategy only where it is one answer of a habit loop (round 7, C2), built from the habit', () => {
    for (const s of listedStrategies()) expect(appliesToHabit(s.key)).toBe(strategyAppliesToHabit(s.key));
    for (const key of ['ride-wave', 'season', 'company', 'self-review']) expect(appliesToHabit(key)).toBe(false);
    const plan = createPlan(
      { id: 'p1', deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['05:30'], createdOn: '2026-10-01' },
      '2026-11-10T08:00:00.000Z',
    );
    const words = { amount: (n: number) => `${n} دقائق`, prayer: () => 'الفجر' };
    const t = (key: string, values?: Record<string, string>) => `${key}|${Object.values(values ?? {}).join(',')}`;
    expect(applySuggestion('start-tiny', { ...plan, minimum: 2 }, words, t)).toBe('items.start-tiny.suggest|2 دقائق');
    expect(applySuggestion('anchor-prayer', { ...plan, slotAnchors: ['after-fajr'] }, words, t)).toBe('items.anchor-prayer.suggest|الفجر');
    expect(applySuggestion('anchor-prayer', plan, words, t)).toBe('');
    expect(applySuggestion('bundle', plan, words, t)).toBe('');
  });

  it('has the question and words of every applied strategy in Arabic', () => {
    for (const s of STRATEGIES.filter((x) => strategyAppliesToHabit(x.key))) {
      const item = (ar.practice.strategies.items as Record<string, { ask?: string }>)[s.key];
      expect(`${s.key}: ${item?.ask ?? ''}`).toContain('{{habit}}');
    }
  });
});

describe('read marks on topic pages', () => {
  const q = (id: string) => ({ id }) as QuoteDto;
  const row = (id: string, link: string): TopicText => ({ link: { id: link, relevanceScore: null, note: null }, quote: q(id) });
  const sections = buildTopicSections([{ items: [row('a', 'l1'), row('b', 'l2')], companion: { items: [row('c', 'l3')] } }], {
    sectioned: true,
    ownTitle: 'own',
    companionTitle: 'comp',
    groupTitle: () => '',
  });

  it('keeps each text’s link id for the reader', () => {
    expect(sections[0]?.links).toEqual({ a: 'l1', b: 'l2', c: 'l3' });
  });

  it('filters read / unread and drops an emptied section', () => {
    const read = new Set(['a', 'c']);
    expect(filterSectionsByRead(sections, 'all', read)).toHaveLength(2);
    expect(filterSectionsByRead(sections, 'unread', read).map((s) => s.data.map((x) => x.id))).toEqual([['b']]);
    expect(filterSectionsByRead(sections, 'read', read).map((s) => s.data.map((x) => x.id))).toEqual([['a'], ['c']]);
  });
});

describe('report a mistake (C-01s)', () => {
  const err = (status: number, code: string) => new ApiError({ status, code, message: '' });
  it('says each refusal kindly', () => {
    expect(reportErrorKey(err(429, 'REPORT_RATE_LIMITED'))).toBe('report.errors.tooMany');
    expect(reportErrorKey(err(429, 'REPORTS_PAUSED'))).toBe('report.errors.paused');
    expect(reportErrorKey(err(413, 'PAYLOAD_TOO_LARGE'))).toBe('report.errors.tooLong');
    expect(reportErrorKey(err(0, 'NETWORK_ERROR'))).toBe('errors.network');
    expect(reportErrorKey(new Error('x'))).toBe('report.errors.generic');
  });
});

describe('home moments (C-09) and صحبة invites (C-01k)', () => {
  it('follows only the app’s topic routes', () => {
    expect(isTopicPath('/sins/ghadab')).toBe(true);
    expect(isTopicPath('/branches/12')).toBe(true);
    expect(isTopicPath('https://evil.example')).toBe(false);
    expect(isTopicPath('/settings/account')).toBe(false);
  });

  it('names the invite errors and links', () => {
    expect(circleErrorKey(new ApiError({ status: 403, code: 'CIRCLES_NOT_ENABLED', message: '' }))).toBe('circles.errors.notEnabled');
    expect(circleErrorKey(new ApiError({ status: 409, code: 'CIRCLE_INVITES_ACTIVE_LIMIT', message: '' }))).toBe('circles.errors.invitesActiveLimit');
    expect(inviteAppLink('ABCDE12345')).toBe('thekra://circles/invite/ABCDE12345');
  });
});

// Owner round 6 (§1, §2, C-01d, C-01f, C-01j): the old words are gone from the app's copy (the glossary terms of
// practice-core nav-map `GLOSSARY` replace them; the website checks the same list in home-sections.spec.ts).
describe('round-6 wording', () => {
  const RETIRED = ['فاتتك', 'أقل ما يمكن', 'ترك معصية', 'أهلي وناسي', 'تصفّح النصوص', 'أوقِف مؤقتًا', 'أوقف مؤقتًا', 'موقوفة مؤقتًا'];
  it('uses none of the retired words in ar.json', () => {
    const text = JSON.stringify(ar);
    for (const word of RETIRED) expect(text.includes(word)).toBe(false);
  });
});
