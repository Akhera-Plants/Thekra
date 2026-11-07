'use client';

import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarPlus, Check, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  buildIcs,
  circleOf,
  deleteRelative,
  dueList,
  isRelativeOpen,
  limits,
  PEOPLE_CIRCLES,
  type PeopleCircle,
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
import { useDeletesEverywhere } from '../hooks/useDeletesEverywhere';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useToday } from '../hooks/useToday';
import { SyncStatus } from './SyncStatus';
import { PracticeLoading } from './PracticeLoading';
import { RelativeForm } from './RelativeForm';
import { RowMenu } from './RowMenu';
import { LimitSheet } from './LimitSheet';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { limitOptions } from '@/lib/practice/limits';
import type { PracticeHabit } from '@/lib/types/practice';

const BUCKETS = ['overdue', 'thisWeek', 'later'] as const;

function changeRelative(id: string, change: (relative: Relative) => Relative): void {
  updateStore((store) => updateRelative(store, id, change));
}

/**
 * صلة الرحم: nicknames and a rhythm, «تواصلت معه», undo, edit, due list, optional calendar file, and the browser
 * reminders card (its 18:00 kinship reminder is promised on /practice too; same gating as there).
 */
export function KinshipView() {
  const t = useTranslations('practice.kinship');
  const tCircles = useTranslations('practice.circles');
  const snapshot = usePracticeStore();
  const clock = useToday();
  const namesId = useId();
  const requested = useSearchParams().get('circle');
  // `?circle=` (from «أعمال دورية»): this page becomes that template's people list. Default صلة الرحم.
  const circle: PeopleCircle = PEOPLE_CIRCLES.includes(requested as PeopleCircle) ? (requested as PeopleCircle) : 'kin';
  const catalog = usePracticeCatalog();
  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );
  const [limitOpen, setLimitOpen] = useState(false);
  if (!snapshot || !clock) return <PracticeLoading />;
  const today = clock.today;
  const all = snapshot.store.relatives.filter((r) => circleOf(r) === circle);
  const relatives = all;
  const visited = all.filter((r) => !isRelativeOpen(r));
  const list = dueList(relatives, today);
  const planLimits = limits(snapshot.store, today, limitOptions(habits));
  function canAdd() {
    if (planLimits.canAdd('periodic', { circle })) return true;
    setLimitOpen(true);
    return false;
  }
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
      {circle !== 'kin' ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium">{tCircles(`${circle}.title`)}</h2>
          <p className="text-sm leading-7 text-muted-foreground">{tCircles(`${circle}.hint`)}</p>
        </div>
      ) : null}
      <RelativeForm today={today} circle={circle} canAdd={canAdd} />
      <LimitSheet
        kind="periodic"
        open={limitOpen}
        onOpenChange={setLimitOpen}
        limits={planLimits}
        store={snapshot.store}
        habits={habits}
        today={today}
      />

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

      {visited.length > 0 ? (
        <section aria-labelledby="kin-visited" className="flex flex-col gap-3">
          <h2 id="kin-visited" className="text-2xl font-medium">
            {tCircles('sick.visited')}
          </h2>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {visited.map((relative) => (
              <li key={relative.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <bdi lang={langOf(relative.name)}>{relative.name}</bdi>
                <RowMenu
                  label={t('optionsOf', { name: relative.name })}
                  remove={{
                    label: t('remove'),
                    confirmTitle: t('removeTitle', { name: relative.name }),
                    confirm: t('removeConfirm'),
                    keep: t('keep'),
                    onConfirm: () => updateStore((s) => deleteRelative(s, relative.id)),
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          <Button variant="outline" tone="primary" size="md" className="self-start" icon={<CalendarPlus aria-hidden />} onClick={handleExport}>
            {t('export')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function RelativeRow({ entry, today }: { entry: DueEntry; today: string }) {
  const t = useTranslations('practice.kinship');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const [editing, setEditing] = useState(false);
  const everywhere = useDeletesEverywhere();
  const editId = useId();
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
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <Button variant="outline" tone="neutral" size="sm" onClick={() => updateStore((s) => undoContact(s, relative.id))}>
              <Undo2 aria-hidden />
              {t('undo')}
            </Button>
          ) : null}
          <RowMenu
            label={t('optionsOf', { name: relative.name })}
            edit={{ label: t('edit'), onSelect: () => setEditing(true) }}
            remove={{
              label: t('remove'),
              confirmTitle: t('removeTitle', { name: relative.name }),
              note: everywhere ? t('removeNoteAccount') : t('removeNoteDevice'),
              confirm: t('removeConfirm'),
              keep: t('keep'),
              onConfirm: () => updateStore((s) => deleteRelative(s, relative.id)),
            }}
          />
        </div>
      </div>
      {editing ? (
        <div id={editId}>
          <RelativeForm today={today} relative={relative} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </li>
  );
}
