/**
 * Topic pages after the website: the reading sections (own texts, companion, derived groups, each text once; one
 * list under a type filter) and the catalogue row meta (domain · كبيرة · معاصر, else the number of texts with the
 * Arabic plural forms).
 */

import i18next from 'i18next';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { buildTopicSections, topicMeta } from '../lib/topics';
import type { QuoteDto, TopicText } from '../lib/types/api';

const text = (id: string): TopicText => ({ link: { id: `l-${id}`, relevanceScore: null, note: null }, quote: { id } as QuoteDto });
const ids = (quotes: QuoteDto[]) => quotes.map((q) => q.id);
const options = { sectioned: true, ownTitle: 'own', companionTitle: 'companion', groupTitle: (g: { nameAr: string }) => g.nameAr };

describe('buildTopicSections', () => {
  it('reads own, companion and derived sections, each text once, across pages', () => {
    const sections = buildTopicSections(
      [
        { items: [text('a'), text('b')], companion: { items: [text('b'), text('c')] }, derived: [{ slug: 'x', nameAr: 'س', side: 'AVOID', items: [text('d')] }] },
        { items: [text('e')], companion: { items: [text('f')] }, derived: [{ slug: 'x', nameAr: 'س', side: 'AVOID', items: [text('a'), text('g')] }] },
      ],
      options,
    );
    expect(sections.map((s) => [s.key, s.title, ids(s.data)])).toEqual([
      ['own', 'own', ['a', 'b', 'e']],
      ['companion', 'companion', ['c', 'f']],
      ['derived:AVOID:x', 'س', ['d', 'g']],
    ]);
  });

  it('keeps each text\'s link note for its card', () => {
    const noted: TopicText = { link: { id: 'l-n', relevanceScore: null, note: 'من كتاب الكبائر' }, quote: { id: 'n' } as QuoteDto };
    const [own] = buildTopicSections([{ items: [noted, text('a')] }], options);
    expect(own?.notes).toEqual({ n: 'من كتاب الكبائر' });
  });

  it('leaves out empty sections and reads one untitled list under a filter', () => {
    expect(buildTopicSections([{ items: [], companion: { items: [] } }], options)).toEqual([]);
    const flat = buildTopicSections(
      [{ items: [text('a')], companion: { items: [text('a'), text('b')] }, derived: [{ slug: 'x', nameAr: 'س', side: 'DO', items: [text('c')] }] }],
      { ...options, sectioned: false },
    );
    expect(flat.map((s) => [s.title, ids(s.data)])).toEqual([[null, ['a', 'b']]]);
  });
});

describe('topicMeta', () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  it('shows the domain, «كبيرة» and «معاصر» as the website does', () => {
    const t = i18n.getFixedT('ar');
    expect(topicMeta({ domainKey: 'lisan', rank: 'KABIRA', isContemporary: true, quoteCount: 12 }, t)).toBe('اللسان والكلام · كبيرة · معاصر');
    expect(topicMeta({ domainKey: 'unknown', rank: 'SAGHIRA', quoteCount: 0 }, t)).toBeUndefined();
  });

  it('counts texts with the Arabic plural forms, in Western digits', () => {
    const t = i18n.getFixedT('ar');
    const meta = (quoteCount: number) => topicMeta({ quoteCount }, t);
    expect(meta(1)).toBe('نص واحد');
    expect(meta(2)).toBe('نصان');
    expect(meta(7)).toBe('7 نصوص');
    expect(meta(12)).toBe('12 نصًا');
    expect(meta(100)).toBe('100 نص');
    expect(topicMeta({ quoteCount: 1 }, i18n.getFixedT('en'))).toBe('1 text');
    expect(topicMeta({ domainKey: 'mal', quoteCount: 3 }, i18n.getFixedT('en'))).toBe('Wealth and dealings');
  });

  it('counts days for «كم يومًا في الأسبوع»', () => {
    const t = i18n.getFixedT('ar');
    expect([2, 3, 7].map((count) => t('practice.add.daysCount', { count }))).toEqual(['يومان', '3 أيام', '7 أيام']);
    expect(i18n.getFixedT('en')('practice.add.daysCount', { count: 3 })).toBe('3 days');
  });
});
