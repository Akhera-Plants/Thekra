'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { BellOff, BellRing, CalendarPlus, CalendarSync, ChevronDown, Download, ExternalLink, Laptop } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { setHeartPrefs, type HeartPrefs, type NotificationPrefs } from '@thekra/practice-core';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { Switch } from '@/components/shared/kit/switch';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { occasionsIcsUrl } from '@/lib/api/practice';
import { EXTENSION_STORE_URL } from '@/lib/extension';
import { formatDigits } from '@/lib/format/digits';
import { calendarRange, computeOccasionDates, groupOccasions, occasionsIcs } from '@/lib/practice/calendar';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { updateHeart } from '@/lib/practice/heart-store';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { planReminderEvents, planRemindersIcs } from '@/lib/practice/plans';
import { loadPushConfig, resendPushPrefs } from '@/lib/push/web-push';
import { queryKeys } from '@/lib/query-keys';
import { localePath } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { useCalendarOccasions } from '../../hooks/useCalendarOccasions';
import { useHeart } from '../../hooks/useHeart';
import { usePushReminders } from '../../hooks/usePushReminders';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { PushRemindersCard } from '../PushRemindersCard';
import { TimeField } from '../TimeField';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** One channel group: its title and its rows (a hairline list). */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="text-xl font-medium">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border">{children}</ul>
    </section>
  );
}

/** A switch row: the label (and its hint) on the reading start, the switch on the end. */
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  const labelId = useId();
  const hintId = useId();
  return (
    <li className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span className="flex min-w-0 flex-col">
        <span id={labelId} className="text-base leading-7">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="text-sm leading-6 text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined} checked={checked} onCheckedChange={onChange} />
    </li>
  );
}

/**
 * A day or a time as a value row (A-29 a: one style for both): the title on the reading start, the value on the end with
 * a chevron; a tap opens its picker under it.
 */
function ValueRow({ label, value, children }: { label: string; value: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="flex min-h-12 w-full items-center gap-3 py-2 ps-4 text-start transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</span>
            <span className="text-base tabular-nums" dir="auto">
              {value}
            </span>
            <ChevronDown aria-hidden className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          {children(() => setOpen(false))}
        </PopoverContent>
      </Popover>
    </li>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const id = useId();
  return (
    <ValueRow label={label} value={formatDigits(value)}>
      {() => <TimeField id={id} label={label} value={value} onChange={onChange} />}
    </ValueRow>
  );
}

function DayRow({ label, value, onChange }: { label: string; value: number; onChange: (day: number) => void }) {
  const tDays = useTranslations('practice.weekdays');
  return (
    <ValueRow label={label} value={tDays(`d${value}`)}>
      {(close) => (
        <div role="radiogroup" aria-label={label} className="flex w-44 flex-col">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={value === d}
              onClick={() => {
                onChange(d);
                close();
              }}
              className={cn(
                'min-h-11 rounded-md px-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                value === d ? 'bg-primary/10 font-medium text-primary-text' : 'hover:bg-muted',
              )}
            >
              {tDays(`d${d}`)}
            </button>
          ))}
        </div>
      )}
    </ValueRow>
  );
}

/**
 * «التنبيهات» (owner round 5, F-29 note «أعد صناعة الـUI», A-29 a, F-17, F-12 a, F-25 b), the same groups as the app
 * (mobile/src/components/settings/NotificationsSettings.tsx), separated by the flower divider: an honest status line,
 * this browser's push (on/off), «العادات», «المحاسبة» (evening and weekly: each switch is its card and its reminder,
 * with its day and time as value rows), «الأعمال الدورية», «مناسبة قريبة» (opt-in, the evening before), «ملف التقويم»
 * (the public occasions feed and the file of the member's own reminders), then the extension once its store page exists.
 * Feature switches («نية اليوم», «التزام شخصي») live in their features; the weekly strategy reminder is gone. «تخفَّف» has
 * no reminder in a browser: push is planned by the server, and the sin never reaches it.
 */
export function NotificationsSettings() {
  const t = useTranslations('practice.notify');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const heart = useHeart();
  if (!context || !heart) return <PracticeLoading />;
  const notify = notificationPrefsOf(context.snapshot.prefs);

  function setNotify(patch: Partial<NotificationPrefs>) {
    updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), ...patch } }));
    void resendPushPrefs(locale);
  }
  const setHeart = (patch: Partial<HeartPrefs>) => updateHeart((h) => setHeartPrefs(h, patch));
  const eveningOn = heart.prefs.eveningReview || notify.eveningNudge;
  const weeklyOn = heart.prefs.fridayReview || notify.fridayReview;
  const anyOn = notify.habits || notify.periodic || eveningOn || weeklyOn || notify.occasions;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <StatusLine anyOn={anyOn} />
      <PushRemindersCard />

      <SectionDivider />

      <Group id="notify-habits" title={t('groupHabits')}>
        <SwitchRow label={t('habits')} hint={t('habitsHint')} checked={notify.habits} onChange={(on) => setNotify({ habits: on })} />
      </Group>

      <SectionDivider />

      <Group id="notify-review" title={t('groupReview')}>
        <SwitchRow
          label={t('eveningReview')}
          checked={eveningOn}
          onChange={(on) => {
            setHeart({ eveningReview: on });
            setNotify({ eveningNudge: on, eveningTime: heart.prefs.eveningFrom });
          }}
        />
        {eveningOn ? (
          <TimeRow
            label={t('time')}
            value={heart.prefs.eveningFrom}
            onChange={(time) => {
              setHeart({ eveningFrom: time });
              setNotify({ eveningTime: time });
            }}
          />
        ) : null}
        <SwitchRow
          label={t('weeklyReview')}
          checked={weeklyOn}
          onChange={(on) => {
            setHeart({ fridayReview: on });
            setNotify({ fridayReview: on });
          }}
        />
        {weeklyOn ? (
          <>
            <DayRow
              label={t('day')}
              value={heart.prefs.reviewDay}
              onChange={(day) => {
                setHeart({ reviewDay: day });
                setNotify({ reviewDay: day });
              }}
            />
            <TimeRow label={t('time')} value={notify.fridayTime} onChange={(time) => setNotify({ fridayTime: time })} />
          </>
        ) : null}
      </Group>

      <SectionDivider />

      <Group id="notify-periodic" title={t('groupPeriodic')}>
        <SwitchRow label={t('periodic')} checked={notify.periodic} onChange={(on) => setNotify({ periodic: on })} />
        {notify.periodic ? (
          <TimeRow label={t('time')} value={notify.periodicTime} onChange={(time) => setNotify({ periodicTime: time })} />
        ) : null}
      </Group>

      <SectionDivider />

      <Group id="notify-occasion" title={t('groupOccasion')}>
        <SwitchRow label={t('occasion')} hint={t('occasionHint')} checked={notify.occasions} onChange={(on) => setNotify({ occasions: on })} />
        {notify.occasions ? (
          <TimeRow label={t('time')} value={notify.occasionTime} onChange={(time) => setNotify({ occasionTime: time })} />
        ) : null}
      </Group>

      <SectionDivider />

      <CalendarFiles context={context} />

      {/* «تذكير على حاسوبك» once the owner publishes the extension (F-25 b); hidden until then. */}
      {EXTENSION_STORE_URL ? (
        <a
          href={EXTENSION_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center gap-3 border-y border-border py-2 transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Laptop className="size-5 shrink-0 text-primary-text" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span>{t('extension')}</span>
            <span className="text-sm text-muted-foreground">{t('extensionHint')}</span>
          </span>
          <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
        </a>
      ) : null}

      <p className="text-sm leading-7 text-muted-foreground">{t('quiet')}</p>
    </div>
  );
}

/**
 * Only what is true (F-29 a): every switch off; this browser receives them; it does not yet (the card under it says
 * why and how); or push cannot reach this browser at all (the calendar file is the way then).
 */
function StatusLine({ anyOn }: { anyOn: boolean }) {
  const t = useTranslations('practice.notify.status');
  const { state } = usePushReminders();
  const config = useQuery({ queryKey: queryKeys.push.config, queryFn: loadPushConfig, staleTime: Infinity });
  let text: string | null = null;
  let on = false;
  if (!anyOn) text = t('allOff');
  else if (state === 'on') {
    text = t('pushOn');
    on = true;
  } else if (state === 'unsupported' || (state === 'hidden' && config.data?.enabled === false)) text = t('unavailable');
  else if (state !== 'hidden') text = t('pushOff');
  if (!text) return null;
  const Icon = on ? BellRing : BellOff;
  return (
    <p role="status" className="flex items-start gap-2 text-base leading-7">
      <Icon className={cn('mt-1 size-5 shrink-0', on ? 'text-primary-text' : 'text-muted-foreground')} aria-hidden />
      <span>{text}</span>
    </p>
  );
}

/**
 * «ملف التقويم» (moved here, F-17 / W-13): the public occasions feed, to subscribe (`webcal:`, re-read daily) or to
 * download (built on this device with its Hijri adjustment); and the member's own habit reminders as a file.
 */
function CalendarFiles({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.notify');
  const tCalendar = useTranslations('calendarPage');
  const tToday = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, habits, today, occasions: catalogOccasions } = context;
  const offset = snapshot.store.settings.hijriOffset;
  const range = useMemo(() => calendarRange(today), [today]);
  const occasions = useCalendarOccasions({ ...range, hijriOffset: offset });
  const rows = useMemo(() => {
    const entries =
      occasions.data ?? (occasions.isError && catalogOccasions ? computeOccasionDates(catalogOccasions, range.from, range.to, offset) : null);
    return entries ? groupOccasions(entries, today) : null;
  }, [range, today, occasions.data, occasions.isError, catalogOccasions, offset]);

  function downloadOccasions() {
    if (!rows) return;
    const origin = window.location.origin;
    const text = occasionsIcs(rows, locale, tCalendar('icsName'), (deed) => new URL(localePath(locale, `/good-deeds/${deed}`), origin).toString());
    downloadTextFile('thekra-occasions.ics', text, ICS_MIME);
  }

  function downloadMine() {
    const events = planReminderEvents(snapshot.store.plans, habits, today, locale, offset);
    downloadTextFile('thekra-reminders.ics', planRemindersIcs(events, tToday('icsName')), ICS_MIME);
  }

  return (
    <section aria-labelledby="notify-file" className="flex flex-col gap-3">
      <h2 id="notify-file" className="text-xl font-medium">
        {t('groupFile')}
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">{t('fileLead')}</p>
      {/* One pair, same size (O-02/W-03): subscribing is the main way, the file the other. */}
      <ActionPair className="sm:max-w-md">
        <Button asChild variant="solid" tone="primary" size="md">
          <a href={occasionsIcsUrl(locale, 'webcal')}>
            <CalendarSync aria-hidden />
            {t('subscribe')}
          </a>
        </Button>
        <Button variant="outline" tone="primary" size="md" icon={<Download aria-hidden />} onClick={downloadOccasions} disabled={!rows || rows.length === 0}>
          {t('download')}
        </Button>
      </ActionPair>
      {snapshot.store.plans.length > 0 ? (
        <button
          type="button"
          onClick={downloadMine}
          className="flex min-h-14 items-center gap-3 border-y border-border py-2 text-start transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CalendarPlus className="size-5 shrink-0 text-primary-text" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span>{t('myFile')}</span>
            <span className="text-sm leading-6 text-muted-foreground">{t('myFileHint')}</span>
          </span>
          <Download className="size-4 text-muted-foreground" aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
