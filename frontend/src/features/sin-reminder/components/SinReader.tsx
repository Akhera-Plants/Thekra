'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem } from '@/components/shared/editorial/ReminderReader';
import { getSinQuotes } from '@/lib/api/sins';

interface SinReaderProps {
  slug: string;
  items: ReaderItem[];
  total: number;
}

export function SinReader({ slug, items, total }: SinReaderProps) {
  const t = useTranslations('sinDetail');

  return (
    <ReminderReader
      items={items}
      total={total}
      intent="sin"
      labels={{
        another: t('anotherReminder'),
        previous: t('previous'),
        next: t('next'),
        showAll: t('showAll'),
        showOne: t('showOne'),
        of: t('of'),
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
