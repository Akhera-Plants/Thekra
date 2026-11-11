'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderHighlight, type ReaderItem, type ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { ReaderStatus } from '@/components/shared/feedback/ReaderStatus';
import { useTopicReader } from '@/components/shared/editorial/useTopicReader';
import { getGoodDeedQuotes } from '@/lib/api/good-deeds';
import type { CountsByKind, TopicThemeCount } from '@/lib/types/api';

interface GoodDeedReaderProps {
  slug: string;
  lang: string;
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
  /** Server-computed kind counts from the initial page fetch. */
  countsByKind?: CountsByKind;
  /** meta.themes: the page's theme chips with counts. */
  themes?: TopicThemeCount[];
  /** meta.theme: the chip the page was rendered with (?theme=). */
  initialTheme?: string | null;
  /** meta.hasNext of the server page: «show more» continues from page 2. */
  initialHasNext?: boolean;
  /** «الميزان», first inside the tabs. */
  highlight?: ReaderHighlight | null;
  /** «الكل» only, before the list. */
  intro?: ReactNode;
  /**
   * Every text is already here (a contemporary topic whose texts come from its derived topics, owner round 3 item 2):
   * the type tabs count and filter on the page instead of asking the API, which knows only the topic's own texts.
   */
  complete?: boolean;
}

export function GoodDeedReader({ slug, lang, items, total, sections, countsByKind, themes, initialTheme = null, initialHasNext = false, highlight = null, intro, complete = false }: GoodDeedReaderProps) {
  const t = useTranslations('goodDeedDetail');
  const reader = useTopicReader({
    queryRoot: 'good-deeds',
    slug,
    lang,
    fetchPage: (query, signal) => getGoodDeedQuotes(slug, query, { signal }),
    initialItems: items,
    initialSections: sections,
    initialCountsByKind: countsByKind,
    themes,
    initialTheme,
    initialHasNext,
  });

  return (
    <>
    <ReminderReader
      heading={t('evidenceHeading')}
      highlight={highlight}
      intro={intro}
      items={complete ? items : reader.items}
      total={total}
      sections={complete ? sections : reader.sections}
      intent="good-deed"
      countsByKind={complete ? undefined : reader.countsByKind}
      onKindChange={complete ? undefined : reader.setKind}
      loadingNextPage={reader.isFetchingNextPage}
      hasNextPage={complete ? false : reader.hasNextPage}
      onShowMore={reader.fetchNextPage}
      themes={complete ? undefined : reader.chips}
      activeTheme={reader.activeTheme}
      onThemeChange={reader.setTheme}
      themeLang={lang === 'en' ? 'en' : 'ar'}
      busy={reader.busy}
      labels={{
        showMore: t('showMore'),
        tabAll: t('typeAll'),
        tabVerses: t('typeVerses'),
        tabHadith: t('typeHadith'),
        tabAthar: t('typeAthar'),
        atharSection: t('atharSection'),
        tabsLabel: t('tabsLabel'),
        themesLabel: t('themesLabel'),
        themeAll: t('themeAll'),
      }}
    />
    <ReaderStatus busy={reader.busy} failed={reader.failed} nextPageFailed={reader.nextPageFailed} error={reader.error} onRetry={reader.retry} />
    </>
  );
}
