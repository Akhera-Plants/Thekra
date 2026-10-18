'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem, type ReaderSection } from '@/components/shared/editorial/ReminderReader';

interface GoodDeedReaderProps {
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
}

export function GoodDeedReader({ items, total, sections }: GoodDeedReaderProps) {
  const t = useTranslations('goodDeedDetail');

  return (
    <ReminderReader
      items={items}
      total={total}
      sections={sections}
      intent="good-deed"
      labels={{
        showMore: t('showMore'),
        tabAll: t('typeAll'),
        tabVerses: t('typeVerses'),
        tabHadith: t('typeHadith'),
        tabsLabel: t('tabsLabel'),
      }}
    />
  );
}
