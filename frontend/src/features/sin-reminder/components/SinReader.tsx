'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem, type ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { getSinQuotes } from '@/lib/api/sins';

interface SinReaderProps {
  slug: string;
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
}

export function SinReader({ slug, items, total, sections }: SinReaderProps) {
  const t = useTranslations('sinDetail');

  return (
    <ReminderReader
      items={items}
      total={total}
      sections={sections}
      intent="sin"
      labels={{
        another: t('anotherReminder'),
        previous: t('previous'),
        next: t('next'),
        showMore: t('showMore'),
        of: t('of'),
        tabAll: t('typeAll'),
        tabVerses: t('typeVerses'),
        tabHadith: t('typeHadith'),
        tabsLabel: t('tabsLabel'),
        closeHighlight: t('closeHighlight'),
      }}
      onAnother={async () => {
        const result = await getSinQuotes(slug, {
          shuffle: true,
          seed: Date.now().toString(36),
          limit: 1,
        });
        const item = result.data.items[0];
        if (!item) return null;
        return { id: item.quote.id, quote: item.quote, note: item.link.note };
      }}
    />
  );
}
