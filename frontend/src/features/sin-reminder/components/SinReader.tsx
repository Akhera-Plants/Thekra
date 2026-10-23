'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem, type ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { ReaderStatus } from '@/components/shared/feedback/ReaderStatus';
import { useTopicReader } from '@/components/shared/editorial/useTopicReader';
import { getSinQuotes } from '@/lib/api/sins';
import type { CountsByKind, TopicThemeCount } from '@/lib/types/api';

interface SinReaderProps {
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
}

export function SinReader({ slug, lang, items, total, sections, countsByKind, themes, initialTheme = null }: SinReaderProps) {
  const t = useTranslations('sinDetail');
  const reader = useTopicReader({
    queryRoot: 'sins',
    slug,
    lang,
    fetchPage: (query, signal) => getSinQuotes(slug, query, { signal }),
    initialItems: items,
    initialSections: sections,
    initialCountsByKind: countsByKind,
    themes,
    initialTheme,
  });

  return (
    <>
    <ReminderReader
      items={reader.items}
      total={total}
      sections={reader.sections}
      intent="sin"
      countsByKind={reader.countsByKind}
      onKindChange={reader.setKind}
      loadingNextPage={reader.isFetchingNextPage}
      hasNextPage={reader.hasNextPage}
      onShowMore={reader.fetchNextPage}
      themes={reader.chips}
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
