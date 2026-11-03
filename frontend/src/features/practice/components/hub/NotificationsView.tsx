'use client';

import { useId, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setHeartPrefs, type HeartPrefs, type NotificationPrefs } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Switch } from '@/components/shared/kit/switch';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { formatDigits } from '@/lib/format/digits';
import { updateHeart } from '@/lib/practice/heart-store';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { resendPushPrefs } from '@/lib/push/web-push';
import { cn } from '@/lib/utils';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { pledgeablePlans } from '../Pledges';
import { PushRemindersCard } from '../PushRemindersCard';
import { TimeField } from '../TimeField';

/** One setting: its label and switch on one line; what it opens (a time, a day) under it while on. */
function SwitchRow({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  const labelId = useId();
  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <span id={labelId} className="text-base">
          {label}
        </span>
        <Switch aria-labelledby={labelId} checked={checked} onCheckedChange={onChange} />
      </div>
      {checked && children ? <div className="flex flex-col gap-3 pb-2">{children}</div> : null}
    </li>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-12 text-sm text-muted-foreground">
        {label}
      </label>
      <TimeField id={id} label={label} value={value} onChange={onChange} />
    </div>
  );
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** The weekly review's day: seven compact options in one row (full names for screen readers). */
function DayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const t = useTranslations('practice.notify');
  const tDays = useTranslations('practice.weekdays');
  const tShort = useTranslations('practice.weekdaysShort');
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm text-muted-foreground">
        {t('day')}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={value === d}
            aria-label={tDays(`d${d}`)}
            onClick={() => onChange(d)}
            className={cn(
              'min-h-11 min-w-0 rounded-xl border px-0.5 !text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:!text-sm',
              value === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
            )}
          >
            {tShort(`d${d}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xl font-medium">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border border-y border-border">{children}</ul>
    </section>
  );
}

/**
 * «التنبيهات», the one place for every switch: this browser's push reminders, then «تذكيرات العادات» (habits, periodic
 * acts), «المحاسبة» («نية اليوم», «محاسبة المساء» = the evening card and its reminder at one time, «المحاسبة الأسبوعية» =
 * the weekly card and its reminder on one day and time, «التزام شخصي» with a link to the pledges), and the strategy
 * reminder once strategies were chosen on «استراتيجيات العادات».
 */
export function NotificationsView() {
  const t = useTranslations('practice.notify');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const heart = useHeart();
  if (!context || !heart) return <PracticeLoading />;
  const notify = notificationPrefsOf(context.snapshot.prefs);
  const plans = pledgeablePlans(context.snapshot.store.plans, context.habits);
  const pledged = plans.filter((p) => heart.pledges.some((x) => x.planId === p.id)).length;

  function setNotify(patch: Partial<NotificationPrefs>) {
    updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), ...patch } }));
    void resendPushPrefs(locale);
  }
  const setHeart = (patch: Partial<HeartPrefs>) => updateHeart((h) => setHeartPrefs(h, patch));

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <PushRemindersCard />

      <Group id="notify-habits" title={t('groupHabits')}>
        <SwitchRow label={t('habits')} checked={notify.habits} onChange={(on) => setNotify({ habits: on })} />
        <SwitchRow label={t('periodic')} checked={notify.periodic} onChange={(on) => setNotify({ periodic: on })}>
          <TimeInput label={t('time')} value={notify.periodicTime} onChange={(time) => setNotify({ periodicTime: time })} />
        </SwitchRow>
        {notify.strategies.length > 0 ? (
          <SwitchRow
            label={t('strategyToggle')}
            checked={context.snapshot.prefs.strategyReminders !== false}
            onChange={(on) => {
              updatePrefs((p) => ({ ...p, strategyReminders: on ? undefined : false }));
              void resendPushPrefs(locale);
            }}
          >
            <TimeInput label={t('time')} value={notify.strategyTime} onChange={(time) => setNotify({ strategyTime: time })} />
          </SwitchRow>
        ) : null}
      </Group>

      <SectionDivider />

      <Group id="notify-review" title={t('groupReview')}>
        <SwitchRow label={t('intention')} checked={heart.prefs.intention} onChange={(on) => setHeart({ intention: on })} />
        <SwitchRow
          label={t('eveningReview')}
          checked={heart.prefs.eveningReview}
          onChange={(on) => {
            setHeart({ eveningReview: on });
            setNotify({ eveningNudge: on });
          }}
        >
          <TimeInput
            label={t('time')}
            value={heart.prefs.eveningFrom}
            onChange={(time) => {
              setHeart({ eveningFrom: time });
              setNotify({ eveningTime: time });
            }}
          />
        </SwitchRow>
        <SwitchRow
          label={t('weeklyReview')}
          checked={heart.prefs.fridayReview}
          onChange={(on) => {
            setHeart({ fridayReview: on });
            setNotify({ fridayReview: on });
          }}
        >
          <DayPicker
            value={heart.prefs.reviewDay}
            onChange={(day) => {
              setHeart({ reviewDay: day });
              setNotify({ reviewDay: day });
            }}
          />
          <TimeInput label={t('time')} value={notify.fridayTime} onChange={(time) => setNotify({ fridayTime: time })} />
        </SwitchRow>
        <SwitchRow label={t('pledges')} checked={heart.prefs.pledges} onChange={(on) => setHeart({ pledges: on })}>
          <Link href="/practice/pledges" className="outline-button self-start">
            {t('pledgesLink')}
            <span className="text-sm text-muted-foreground">{t('pledgesCount', { n: formatDigits(pledged), total: formatDigits(plans.length) })}</span>
            <DirectionalArrow />
          </Link>
        </SwitchRow>
      </Group>
    </div>
  );
}
