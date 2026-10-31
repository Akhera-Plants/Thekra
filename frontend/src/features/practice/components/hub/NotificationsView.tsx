'use client';

import { useId, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  addPledge,
  isValidTime,
  removePledge,
  setHeartPrefs,
  type HeartPrefs,
  type NotificationPrefs,
  type PledgeAction,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import { updateHeart } from '@/lib/practice/heart-store';
import { newUuid } from '@/lib/practice/ids';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { resendPushPrefs } from '@/lib/push/web-push';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { PushRemindersCard } from '../PushRemindersCard';
import { pledgeText, planTitle } from './HeartCards';

function Toggle({ label, hint, checked, onChange, children }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  const hintId = useId();
  return (
    <li className="flex flex-col gap-2 py-3">
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={checked}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-base">{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="ps-7 text-sm leading-7 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {checked && children ? <div className="ps-7">{children}</div> : null}
    </li>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <Input id={id} type="time" className="h-11 w-36" value={value} onChange={(e) => isValidTime(e.target.value) && onChange(e.target.value)} />
    </div>
  );
}

/**
 * «التنبيهات» (redesign §4.4), the one place for every switch: this browser's push reminders (habits, periodic acts,
 * the evening nudge, the Friday review reminder, with their times; the server plans them with practice-core
 * `notificationPlan`), then «نية اليوم والمحاسبة» (device-local) and «التزام شخصي» with its pledges.
 */
export function NotificationsView() {
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

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <PushRemindersCard />

      <section aria-labelledby="notify-switches" className="flex flex-col gap-2">
        <h2 id="notify-switches" className="sr-only">
          {t('title')}
        </h2>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          <Toggle label={t('habits')} checked={notify.habits} onChange={(on) => setNotify({ habits: on })} />
          <Toggle label={t('periodic')} checked={notify.periodic} onChange={(on) => setNotify({ periodic: on })}>
            <TimeInput label={t('time')} value={notify.periodicTime} onChange={(time) => setNotify({ periodicTime: time })} />
          </Toggle>
          <Toggle label={t('evening')} checked={notify.eveningNudge} onChange={(on) => setNotify({ eveningNudge: on })}>
            <TimeInput label={t('time')} value={notify.eveningTime} onChange={(time) => setNotify({ eveningTime: time })} />
          </Toggle>
          <Toggle label={t('friday')} checked={notify.fridayReview} onChange={(on) => setNotify({ fridayReview: on })}>
            <TimeInput label={t('time')} value={notify.fridayTime} onChange={(time) => setNotify({ fridayTime: time })} />
          </Toggle>
        </ul>
      </section>

      <section aria-labelledby="notify-heart" className="flex flex-col gap-2">
        <h2 id="notify-heart" className="text-xl font-medium">
          {t('heartTitle')}
        </h2>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          <Toggle label={t('intention')} checked={heart.prefs.intention} onChange={(on) => setHeart({ intention: on })} />
          <Toggle label={t('eveningReview')} checked={heart.prefs.eveningReview} onChange={(on) => setHeart({ eveningReview: on })} />
          <Toggle label={t('fridayReview')} checked={heart.prefs.fridayReview} onChange={(on) => setHeart({ fridayReview: on })} />
          <Toggle label={t('pledges')} hint={t('pledgesHint')} checked={heart.prefs.pledges} onChange={(on) => setHeart({ pledges: on })}>
            <PledgeEditor />
          </Toggle>
        </ul>
      </section>
    </div>
  );
}

/** The pledges, one per habit: «إن فاتتني يومين متتاليين: [أتصدق بـ… / أصلي ركعتين / نص أكتبه]». */
function PledgeEditor() {
  const t = useTranslations('practice.notify');
  const tPledge = useTranslations('practice.heart.pledge');
  const english = useLocale() === 'en';
  const context = useWirdContext();
  const heart = useHeart();
  const [planId, setPlanId] = useState('');
  const [action, setAction] = useState<PledgeAction>('rakatain');
  const [text, setText] = useState('');
  const habitId = useId();
  const textId = useId();
  if (!context || !heart) return null;
  const { store } = context.snapshot;
  const plans = store.plans;
  const chosen = planId || plans[0]?.id || '';
  const needsText = action === 'custom';

  function add() {
    if (!chosen || (needsText && text.trim() === '') || !context) return;
    updateHeart((h) => addPledge(h, { id: newUuid(), planId: chosen, action, text, createdOn: context.today }));
    setText('');
  }

  return (
    <div className="flex flex-col gap-4">
      {heart.pledges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pledgeNone')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {heart.pledges.map((pledge) => {
            const plan = plans.find((p) => p.id === pledge.planId);
            return (
              <li key={pledge.id} className="flex flex-wrap items-center gap-2 text-sm leading-7">
                <span className="font-medium">{plan ? planTitle(plan, context.habits, english) : ''}</span>
                <span className="text-muted-foreground">· {pledgeText(pledge, tPledge)}</span>
                <Button size="sm" variant="ghost" tone="neutral" onClick={() => updateHeart((h) => removePledge(h, pledge.id))}>
                  {t('pledgeRemove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noHabits')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <label htmlFor={habitId} className="text-sm font-medium">
            {t('pledgeHabit')}
          </label>
          <select
            id={habitId}
            className="h-11 rounded-lg border border-input bg-transparent px-2 text-base"
            value={chosen}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {planTitle(p, context.habits, english)}
              </option>
            ))}
          </select>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t('pledgeIf')}</legend>
            {(
              [
                ['sadaqah', t('pledgeSadaqah')],
                ['rakatain', t('pledgeRakatain')],
                ['custom', t('pledgeCustom')],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="radio" name="pledge-action" className="size-4 accent-primary" checked={action === key} onChange={() => setAction(key)} />
                {label}
              </label>
            ))}
          </fieldset>
          {action !== 'rakatain' ? (
            <>
              <label htmlFor={textId} className="text-sm font-medium">
                {t('pledgeText')}
              </label>
              <Input id={textId} className="h-11" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
            </>
          ) : null}
          <Button size="sm" className="self-start" disabled={needsText && text.trim() === ''} onClick={add}>
            {t('pledgeAdd')}
          </Button>
        </div>
      )}
    </div>
  );
}
