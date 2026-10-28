'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN } from '@thekra/practice-core';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateStore } from '@/lib/practice/local-store';

const OFFSETS = Array.from({ length: HIJRI_OFFSET_MAX - HIJRI_OFFSET_MIN + 1 }, (_, i) => HIJRI_OFFSET_MIN + i);

interface HijriOffsetSelectProps {
  value: number;
}

/** «تعديل التاريخ الهجري» −2…+2 days, saved in the device store settings. */
export function HijriOffsetSelect({ value }: HijriOffsetSelectProps) {
  const t = useTranslations('calendarPage.offset');
  const id = useId();
  const hintId = `${id}-hint`;

  function handleChange(next: string) {
    const offset = Number(next);
    updateStore((store) => ({ ...store, settings: { ...store.settings, hijriOffset: offset } }));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('label')}</Label>
      <Select value={String(value)} onValueChange={handleChange}>
        <SelectTrigger id={id} aria-describedby={hintId} className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OFFSETS.map((offset) => (
            <SelectItem key={offset} value={String(offset)}>
              {offset === 0 ? t('none') : t(offset > 0 ? 'plus' : 'minus', { n: String(Math.abs(offset)) })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={hintId} className="text-sm leading-7 text-muted-foreground">
        {t('hint')}
      </p>
    </div>
  );
}
