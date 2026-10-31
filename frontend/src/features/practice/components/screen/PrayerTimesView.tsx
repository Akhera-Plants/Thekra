'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ALADHAN_METHODS,
  ANCHOR_LABELS,
  defaultMethodForCountry,
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
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { resendPushPrefs } from '@/lib/push/web-push';
import {
  prayerCacheStore,
  prayerSettingsStore,
  refreshPrayerTimes,
  useHydrated,
  usePrayerSettings,
  usePrayerTimesToday,
} from '@/lib/practice/screen-stores';
import { PracticeLoading } from '../PracticeLoading';

type Status = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * «أوقات الصلاة» (redesign §4.6): the city whose prayer times anchor «بعد الفجر»… reminders. The browser fetches 30 days
 * from AlAdhan (method by country unless chosen, manual minutes per prayer) and keeps them here; without a city or
 * offline the anchors use default times.
 */
export function PrayerTimesView() {
  const hydrated = useHydrated();
  const saved = usePrayerSettings();
  if (!hydrated) return <PracticeLoading />;
  return <PrayerForm key={saved ? `${saved.city}|${saved.country}` : 'empty'} saved={saved} />;
}

function PrayerForm({ saved }: { saved: PrayerSettings | null }) {
  const t = useTranslations('practice.prayer');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const today = usePrayerTimesToday();
  const [city, setCity] = useState(saved?.city ?? '');
  const [country, setCountry] = useState(saved?.country ?? '');
  const [method, setMethod] = useState<number | null>(saved?.method ?? null);
  const [offsets, setOffsets] = useState<Record<Prayer, number>>(saved?.offsets ?? emptyOffsets());
  const [status, setStatus] = useState<Status>('idle');
  const cityId = useId();
  const countryId = useId();
  const methodId = useId();
  const effectiveMethod = method ?? (country.length === 2 ? defaultMethodForCountry(country) : null);

  async function save() {
    const next = parsePrayerSettings({ city, country, method: effectiveMethod ?? undefined, offsets });
    if (!next) {
      setStatus('failed');
      return;
    }
    setStatus('saving');
    prayerSettingsStore.update(() => next);
    const result = await refreshPrayerTimes(true);
    setStatus(result === 'updated' ? 'saved' : 'failed');
    void resendPushPrefs(locale);
  }

  function clear() {
    prayerSettingsStore.update(() => null);
    prayerCacheStore.update(() => null);
    void resendPushPrefs(locale);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={cityId}>{t('city')}</label>
            <Input id={cityId} className="h-11" maxLength={MAX_CITY_LENGTH} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={countryId}>{t('country')}</label>
            <Input
              id={countryId}
              className="h-11 w-28 uppercase"
              dir="ltr"
              maxLength={2}
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor={methodId}>{t('method')}</label>
          <select
            id={methodId}
            className="h-11 rounded-md border border-input bg-background px-3"
            value={effectiveMethod ?? ''}
            onChange={(e) => setMethod(Number(e.target.value))}
          >
            {effectiveMethod === null ? <option value="">{t('methodByCountry')}</option> : null}
            {ALADHAN_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {locale === 'en' ? m.en : m.ar}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t('offsets')}</legend>
          <div className="grid gap-3 sm:grid-cols-5">
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
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? t('saving') : t('save')}
          </Button>
          {saved ? (
            <Button type="button" variant="ghost" tone="neutral" onClick={clear}>
              {t('clear')}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {status === 'saved' ? t('saved') : status === 'failed' ? t('failed') : t('helper')}
        </p>
      </form>

      <section aria-labelledby="prayer-today" className="flex flex-col gap-3">
        <h2 id="prayer-today" className="text-xl font-medium">
          {t('anchorsTitle')}
        </h2>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {PRAYER_ANCHORS.map((anchor) => (
            <li key={anchor} className="flex justify-between py-2 text-base">
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
