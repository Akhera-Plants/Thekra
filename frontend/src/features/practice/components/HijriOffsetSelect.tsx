'use client';

import { useId } from 'react';
import { CalendarCog } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN, updateSettings } from '@thekra/practice-core';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateStore } from '@/lib/practice/local-store';

const OFFSETS = Array.from({ length: HIJRI_OFFSET_MAX - HIJRI_OFFSET_MIN + 1 }, (_, i) => HIJRI_OFFSET_MIN + i);

interface HijriOffsetSelectProps {
  value: number;
  /** Inside the dialog: the dialog holds the title and the hint. */
  bare?: boolean;
}

/** «تعديل التاريخ الهجري» −2…+2 days, saved in the device store settings. */
export function HijriOffsetSelect({ value, bare = false }: HijriOffsetSelectProps) {
  const t = useTranslations('calendarPage.offset');
  const id = useId();
  const hintId = `${id}-hint`;

  function handleChange(next: string) {
    const offset = Number(next);
    updateStore((store) => updateSettings(store, { hijriOffset: offset }));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={bare ? 'sr-only' : undefined}>
        {t('label')}
      </Label>
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
      <p id={hintId} className={bare ? 'sr-only' : 'text-sm leading-7 text-muted-foreground'}>
        {t('hint')}
      </p>
    </div>
  );
}

/** The Hijri adjustment behind an icon button (owner round 3: a popup, not inline under the page). */
export function HijriOffsetDialog({ value }: HijriOffsetSelectProps) {
  const t = useTranslations('calendarPage.offset');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="outline-button !min-h-11 px-3" aria-label={t('label')} title={t('label')}>
          <CalendarCog aria-hidden />
          <span className="hidden sm:inline">{t('label')}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('label')}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>
        <HijriOffsetSelect value={value} bare />
      </DialogContent>
    </Dialog>
  );
}
