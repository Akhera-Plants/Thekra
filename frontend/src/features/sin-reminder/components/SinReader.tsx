'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem, type ReaderSection } from '@/components/shared/editorial/ReminderReader';

interface SinReaderProps {
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
}

export function SinReader({ items, total, sections }: SinReaderProps) {
  const t = useTranslations('sinDetail');

  return (
    <ReminderReader
      items={items}
      total={total}
      sections={sections}
      intent="sin"
      labels={{
        showMore: t('showMore'),
        tabAll: t('typeAll'),
        tabVerses: t('typeVerses'),
        tabHadith: t('typeHadith'),
        tabAthar: t('typeAthar'),
        atharSection: t('atharSection'),
        tabsLabel: t('tabsLabel'),
      }}
    />
  );
}
