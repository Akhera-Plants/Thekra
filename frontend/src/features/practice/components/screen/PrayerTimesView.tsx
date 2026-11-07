'use client';

import { useId, useState } from 'react';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ALADHAN_METHODS,
  ANCHOR_LABELS,
  emptyOffsets,
  MAX_CITY_LENGTH,
  MAX_PRAYER_OFFSET,
  parsePrayerSettings,
  PRAYER_ANCHORS,
  PRAYERS,
  resolveAnchor,
  type Prayer,
  type PrayerSettings,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { resendPushPrefs } from '@/lib/push/web-push';
import {
  lookupCity,
  prayerCacheStore,
  prayerSettingsStore,
  refreshPrayerTimes,
  useHydrated,
  usePrayerSettings,
  usePrayerTimesToday,
  type CityLookup,
} from '@/lib/practice/screen-stores';
import { cn } from '@/lib/utils';
import { PracticeLoading } from '../PracticeLoading';

type Status = { kind: 'idle' } | { kind: 'searching' } | CityLookup;

/** The method's name in the page language, or null when AlAdhan used one this list does not name. */
function methodName(id: number | undefined | null, locale: 'ar' | 'en'): string | null {
  const method = ALADHAN_METHODS.find((m) => m.id === id);
  return method ? (locale === 'en' ? method.en : method.ar) : null;
}

/**
 * «الإعدادات › أوقات الصلاة» (round 5, F-27 note): the member types a city only; «ابحث» asks AlAdhan
 * (`timingsByAddress`), which finds the place and picks the nearest calculation method. The found place and method are
 * one line; «احفظ» keeps it and loads 30 days of times for the «بعد الفجر»… reminders. A city AlAdhan cannot find, or no
 * connection, says so plainly. Manual minutes per prayer stay behind «تعديل يدوي».
 */
export function PrayerTimesView() {
  const hydrated = useHydrated();
  const saved = usePrayerSettings();
  if (!hydrated) return <PracticeLoading />;
  return <PrayerForm key={saved ? `${saved.city}|${saved.method ?? ''}` : 'empty'} saved={saved} />;
}

function PrayerForm({ saved }: { saved: PrayerSettings | null }) {
  const t = useTranslations('practice.prayer');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const today = usePrayerTimesToday();
  const [city, setCity] = useState(saved?.city ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [offsets, setOffsets] = useState<Record<Prayer, number>>(saved?.offsets ?? emptyOffsets());
  const [saving, setSaving] = useState(false);
  const cityId = useId();
  const statusId = useId();
  const found = status.kind === 'found' ? status : null;

  async function search() {
    setStatus({ kind: 'searching' });
    setStatus(await lookupCity(city));
  }

  async function save(next: PrayerSettings | null, message: string) {
    if (!next) return;
    setSaving(true);
    prayerSettingsStore.update(() => next);
    const result = await refreshPrayerTimes(true);
    setSaving(false);
    void resendPushPrefs(locale);
    if (result === 'updated') toast.success(message);
    else toast.error(t('failed'));
  }

  function clear() {
    prayerSettingsStore.update(() => null);
    prayerCacheStore.update(() => null);
    void resendPushPrefs(locale);
    toast.success(t('cleared'));
  }

  const savedLine = saved
    ? [saved.city, methodName(saved.method, locale) ?? t('methodAuto')].join(' · ')
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {savedLine ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-base">
          <MapPin aria-hidden className="size-5 shrink-0 text-primary-text" />
          <span className="min-w-0 flex-1">{savedLine}</span>
          <Button variant="ghost" tone="neutral" size="sm" onClick={clear}>
            {t('clear')}
          </Button>
        </p>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        noValidate
        aria-describedby={statusId}
      >
        <label htmlFor={cityId} className="text-base font-medium">
          {saved ? t('changeCity') : t('city')}
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={cityId}
            className="h-11 min-w-0 flex-1 basis-56"
            maxLength={MAX_CITY_LENGTH}
            value={city}
            placeholder={t('cityPlaceholder')}
            autoComplete="address-level2"
            aria-invalid={status.kind === 'notFound' || undefined}
            onChange={(e) => {
              setCity(e.target.value);
              if (status.kind !== 'idle') setStatus({ kind: 'idle' });
            }}
          />
          <Button type="submit" icon={<Search aria-hidden />} loading={status.kind === 'searching'} disabled={city.trim().length === 0}>
            {t('search')}
          </Button>
        </div>
        <div id={statusId} role="status" className="min-h-7 text-sm leading-7">
          {status.kind === 'notFound' ? (
            <span className="text-destructive">{t('notFound')}</span>
          ) : status.kind === 'offline' ? (
            <span className="text-destructive">{t('offline')}</span>
          ) : status.kind === 'idle' && !saved ? (
            <span className="text-muted-foreground">{t('helper')}</span>
          ) : null}
        </div>
        {found ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-secondary/50 px-4 py-3">
            <p className="text-base leading-7">
              {t('foundLine', {
                city: found.city,
                place: [found.meta.latitude, found.meta.longitude].map((n) => formatDigits(n.toFixed(2))).join(locale === 'ar' ? '، ' : ', '),
                method: methodName(found.meta.method, locale) ?? t('methodAuto'),
              })}
            </p>
            <Button
              loading={saving}
              onClick={() =>
                void save(
                  parsePrayerSettings({ city: found.city, method: found.meta.method ?? undefined, offsets }),
                  t('saved'),
                )
              }
            >
              {t('save')}
            </Button>
          </div>
        ) : null}
      </form>

      {saved ? (
        <details className="group rounded-2xl border border-border px-4 py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-base font-medium">
            {t('offsets')}
            <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="flex flex-col gap-3 pb-4">
            <p className="text-sm leading-7 text-muted-foreground">{t('offsetsHint')}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {PRAYERS.map((p) => (
                <label key={p} className="flex flex-col gap-1 text-sm">
                  {t(`prayers.${p}`)}
                  <Input
                    type="number"
                    className="h-11"
                    min={-MAX_PRAYER_OFFSET}
                    max={MAX_PRAYER_OFFSET}
                    step={1}
                    value={offsets[p]}
                    onChange={(e) => setOffsets({ ...offsets, [p]: Number(e.target.value) || 0 })}
                  />
                </label>
              ))}
            </div>
            <Button
              variant="outline"
              tone="primary"
              className="self-start"
              loading={saving}
              onClick={() => void save(parsePrayerSettings({ ...saved, offsets }), t('offsetsSaved'))}
            >
              {t('saveOffsets')}
            </Button>
          </div>
        </details>
      ) : null}

      <SectionDivider />

      <section aria-labelledby="prayer-today" className="flex flex-col gap-3">
        <h2 id="prayer-today" className="text-xl font-medium">
          {t('anchorsTitle')}
        </h2>
        <ul className="flex flex-col divide-y divide-border border-b border-border">
          {PRAYER_ANCHORS.map((anchor) => (
            <li key={anchor} className={cn('flex justify-between py-2.5 text-base', !today && 'text-muted-foreground')}>
              <span>{ANCHOR_LABELS[locale][anchor]}</span>
              <span className="tabular-nums">{formatDigits(resolveAnchor(anchor, today))}</span>
            </li>
          ))}
        </ul>
        {!today ? <p className="text-sm text-muted-foreground">{t('defaults')}</p> : null}
      </section>
    </div>
  );
}
