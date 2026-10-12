'use client';

import { useTranslations } from 'next-intl';
import { ReminderReader, type ReaderItem } from '@/components/shared/editorial/ReminderReader';
import { getGoodDeedQuotes } from '@/lib/api/good-deeds';

interface GoodDeedReaderProps {
  slug: string;
  items: ReaderItem[];
  total: number;
}

export function GoodDeedReader({ slug, items, total }: GoodDeedReaderProps) {
  const t = useTranslations('goodDeedDetail');

  return (
    <ReminderReader
      items={items}
      total={total}
      intent="good-deed"
      labels={{
        another: t('anotherMotivation'),
        previous: t('previous'),
        next: t('next'),
        showAll: t('showAll'),
        showOne: t('showOne'),
        of: t('of'),
      }}
      onAnother={async () => {
        const result = await getGoodDeedQuotes(slug, {
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
