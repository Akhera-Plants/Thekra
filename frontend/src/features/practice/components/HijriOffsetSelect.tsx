'use client';

import { useId } from 'react';
import { CalendarCog } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN, updateSettings } from '@thekra/practice-core';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateStore } from '@/lib/practice/local-store';
import { Button } from '@/components/shared/kit/button';
import { usePracticeStore } from '../hooks/usePracticeStore';

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

/**
 * «ضبط الهجري»: the page's action on the title line, icon + text (W-13), opening the adjustment in a dialog
 * (owner round 3: a popup, not inline under the page). Reads the device store itself, so a server page can place it.
 */
export function HijriOffsetDialog() {
  const t = useTranslations('calendarPage.offset');
  const snapshot = usePracticeStore();
  const value = snapshot?.store.settings.hijriOffset ?? 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" tone="primary" size="sm" icon={<CalendarCog aria-hidden />} disabled={!snapshot}>
          {t('action')}
        </Button>
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
