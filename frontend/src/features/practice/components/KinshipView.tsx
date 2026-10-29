'use client';

import { useId, useState } from 'react';
import { CalendarPlus, Check, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  buildIcs,
  deleteRelative,
  dueList,
  logContact,
  undoContact,
  updateRelative,
  type DueEntry,
  type Relative,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { formatGregorian } from '@/lib/practice/format';
import { kinshipEvents, langOf, rhythmOf } from '@/lib/practice/kinship';
import { updatePrefs, updateStore } from '@/lib/practice/local-store';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useToday } from '../hooks/useToday';
import { SyncStatus } from './SyncStatus';
import { PracticeLoading } from './PracticeLoading';
import { RelativeForm } from './RelativeForm';

const BUCKETS = ['overdue', 'thisWeek', 'later'] as const;

function changeRelative(id: string, change: (relative: Relative) => Relative): void {
  updateStore((store) => updateRelative(store, id, change));
}

/** صلة الرحم: nicknames and a rhythm, «تواصلت معه», undo, due list, optional calendar file. */
export function KinshipView() {
  const t = useTranslations('practice.kinship');
  const snapshot = usePracticeStore();
  const clock = useToday();
  const namesId = useId();
  if (!snapshot || !clock) return <PracticeLoading />;
  const today = clock.today;
  const relatives = snapshot.store.relatives;
  const list = dueList(relatives, today);
  const withNames = snapshot.prefs.kinshipNamesInCalendar === true;

  function handleExport() {
    const events = kinshipEvents(relatives, today, (relative) =>
      withNames ? t('icsTitleNamed', { name: relative.name }) : t('icsTitle'),
    );
    downloadTextFile('thekra-kinship.ics', buildIcs({ calendarName: t('icsName'), events }), ICS_MIME);
  }

  return (
    <div className="flex flex-col gap-10">
      <SyncStatus persistent={snapshot.persistent} />
      <RelativeForm today={today} />

      {relatives.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        BUCKETS.map((bucket) =>
          list[bucket].length > 0 ? (
            <section key={bucket} aria-labelledby={`kin-${bucket}`} className="flex flex-col gap-3">
              <h2 id={`kin-${bucket}`} className="text-2xl font-medium">
                {t(`buckets.${bucket}`)}
              </h2>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {list[bucket].map((entry) => (
                  <RelativeRow key={entry.relative.id} entry={entry} today={today} />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}

      {relatives.length > 0 ? (
        <section aria-labelledby="kin-export" className="flex flex-col gap-3">
          <h2 id="kin-export" className="text-2xl font-medium">
            {t('exportTitle')}
          </h2>
          <label htmlFor={namesId} className="flex cursor-pointer items-start gap-3">
            <input
              id={namesId}
              type="checkbox"
              className="mt-1.5 size-4 shrink-0 accent-primary"
              checked={withNames}
              aria-describedby={`${namesId}-warning`}
              onChange={(event) => updatePrefs((prefs) => ({ ...prefs, kinshipNamesInCalendar: event.target.checked }))}
            />
            <span>{t('namesOptIn')}</span>
          </label>
          <p id={`${namesId}-warning`} className="text-sm leading-7 text-muted-foreground">
            {withNames ? t('namesWarning') : t('genericNote')}
          </p>
          <button type="button" className="outline-button button-wrap self-start" onClick={handleExport}>
            <CalendarPlus aria-hidden />
            {t('export')}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function RelativeRow({ entry, today }: { entry: DueEntry; today: string }) {
  const t = useTranslations('practice.kinship');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { relative, nextDue, daysUntilDue } = entry;
  const preset = rhythmOf(relative.rule);
  const rhythm = preset
    ? preset.weekday === null
      ? t(`form.rhythms.${preset.rhythm}`)
      : t('rhythmOn', { rhythm: t(`form.rhythms.${preset.rhythm}`), day: tDays(`d${preset.weekday}`) })
    : t('rhythmCustom');
  const when =
    daysUntilDue < 0
      ? t('overdueBy', { count: -daysUntilDue, n: formatDigits(-daysUntilDue) })
      : daysUntilDue === 0
        ? t('dueToday')
        : formatGregorian(nextDue, locale, true);
  const contactedToday = relative.history.includes(today);
  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-lg font-medium break-words">
          <bdi lang={langOf(relative.name)}>{relative.name}</bdi>
          {relative.relation ? (
            <span className="text-base font-normal text-muted-foreground">
              {' · '}
              <bdi lang={langOf(relative.relation)}>{relative.relation}</bdi>
            </span>
          ) : null}
        </p>
        <p className="text-sm leading-7 text-muted-foreground">
          {rhythm} · {when}
          {relative.lastContactedOn ? (
            <> · {t('lastContact', { date: formatGregorian(relative.lastContactedOn, locale) })}</>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={contactedToday ? 'outline' : 'solid'}
          tone="primary"
          size="sm"
          disabled={contactedToday}
          onClick={() => changeRelative(relative.id, (r) => logContact(r, today))}
        >
          <Check aria-hidden />
          {contactedToday ? t('contactedToday') : t('contacted')}
        </Button>
        {relative.history.length > 0 ? (
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => updateStore((s) => undoContact(s, relative.id))}>
            <Undo2 aria-hidden />
            {t('undo')}
          </Button>
        ) : null}
        {confirmRemove ? (
          <>
            <Button
              variant="outline"
              tone="destructive"
              size="sm"
              onClick={() => updateStore((s) => deleteRelative(s, relative.id))}
            >
              {t('removeConfirm')}
            </Button>
            <Button variant="ghost" tone="neutral" size="sm" onClick={() => setConfirmRemove(false)}>
              {t('keep')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setConfirmRemove(true)}>
            {t('remove')}
          </Button>
        )}
      </div>
    </li>
  );
}
