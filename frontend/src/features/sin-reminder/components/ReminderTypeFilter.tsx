'use client';

import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { QuoteType } from '@/lib/types/enums';

interface ReminderTypeFilterProps {
  /** Available types with counts, from SinQuotesMeta.countsByType */
  countsByType: Partial<Record<QuoteType, number>>;
  selected: QuoteType | null;
  onSelect: (type: QuoteType | null) => void;
}

const TYPE_KEY_MAP: Record<QuoteType, string> = {
  QURAN_VERSE: 'typeQuran',
  HADITH: 'typeHadith',
  SCHOLAR_QUOTE: 'typeScholar',
  BOOK_EXCERPT: 'typeBook',
};

export function ReminderTypeFilter({
  countsByType,
  selected,
  onSelect,
}: ReminderTypeFilterProps) {
  const t = useTranslations('sinDetail');
  const types = Object.keys(countsByType) as QuoteType[];

  if (types.length <= 1) return null;

  return (
    <ToggleGroup
      type="single"
      value={selected ?? ''}
      onValueChange={(v) => onSelect(v === '' ? null : (v as QuoteType))}
      aria-label={t('typeAll')}
      className="flex flex-wrap gap-2"
    >
      <ToggleGroupItem value="" aria-label={t('typeAll')} size="sm">
        {t('typeAll')}
      </ToggleGroupItem>
      {types.map((type) => (
        <ToggleGroupItem
          key={type}
          value={type}
          size="sm"
          aria-label={t(TYPE_KEY_MAP[type])}
        >
          {t(TYPE_KEY_MAP[type])}
          {countsByType[type] !== undefined && (
            <bdi className="ms-1 text-xs text-muted-foreground">
              ({countsByType[type]})
            </bdi>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
