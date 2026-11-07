'use client';

import { Ellipsis, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  FARD_EVIDENCE,
  FARD_LABELS,
  FARD_PRAYERS,
  fardOn,
  setFard,
  setFardTracking,
  type FardPrayer,
  type FardStatus,
  type Store,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';
import { EvidenceButton } from '../EvidenceButton';

/**
 * «الفرائض» (round 5, F-05 a): opt-in rows of the five prayers on «ورد اليوم», each with «في وقتها» and «قضاء» (a second
 * tap clears it). Not a habit: outside the limit of 3 and the streak. The evidence opens behind «الدليل»; the section's
 * «⋯» hides it again (the marks are kept). Turned on from «أضف».
 */
export function FardSection({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.fard');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const labels = FARD_LABELS[lang];
  const marks = fardOn(store, today);

  function mark(prayer: FardPrayer, status: FardStatus) {
    const next = marks[prayer] === status ? null : status;
    updateStore((s) => setFard(s, { date: today, prayer, status: next, today }));
  }

  return (
    <section aria-labelledby="fard-title" className="flex flex-col gap-3">
      <TitleRow
        action={
          <div className="flex items-center gap-2">
            <EvidenceButton ids={FARD_EVIDENCE} deed={labels.title} />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" tone="neutral" size="sm" iconOnly icon={<Ellipsis aria-hidden />} aria-label={t('options')} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-56 p-1.5">
                <DropdownMenuItem
                  className="min-h-11 px-2"
                  onSelect={() => {
                    updateStore((s) => setFardTracking(s, false));
                    toast.success(t('hidden'));
                  }}
                >
                  <EyeOff aria-hidden />
                  {t('hide')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
        <h2 id="fard-title" className="text-2xl font-medium">
          {labels.title}
        </h2>
      </TitleRow>
      <ul className="flex flex-col divide-y divide-border border-b border-border">
        {FARD_PRAYERS.map((prayer) => (
          <li key={prayer} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5">
            <span className="text-base font-medium">{labels.prayers[prayer]}</span>
            <div role="group" aria-label={labels.prayers[prayer]} className="flex gap-2">
              {(['onTime', 'qada'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={marks[prayer] === status}
                  onClick={() => mark(prayer, status)}
                  className={cn(
                    'touch-44 inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                    marks[prayer] === status ? 'border-primary bg-secondary font-medium text-primary-text' : 'border-border hover:bg-muted',
                  )}
                >
                  {status === 'onTime' ? t('onTime') : t('qada')}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
