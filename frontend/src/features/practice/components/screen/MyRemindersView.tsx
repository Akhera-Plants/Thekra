'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  addMyReminder,
  MY_REMINDER_MAX_LENGTH,
  MY_REMINDERS_MAX,
  myReminderError,
  removeMyReminder,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { newUuid } from '@/lib/practice/ids';
import { myRemindersStore, useMyReminders } from '@/lib/practice/screen-stores';
import { PracticeLoading } from '../PracticeLoading';

/**
 * «تذكيراتي» (redesign §4.6; a tab of «المحفوظات» since 2026-11-01): the user's own short lines, kept on this browser only («على جهازي فقط», the only mode
 * for now). At most {@link MY_REMINDERS_MAX} lines of {@link MY_REMINDER_MAX_LENGTH} characters.
 */
export function MyRemindersView() {
  const t = useTranslations('practice.myReminders');
  const list = useMyReminders();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  if (!list) return <PracticeLoading />;

  function add() {
    const current = myRemindersStore.get();
    const problem = myReminderError(current, text);
    if (problem) {
      setError(t(`errors.${problem}`, { max: formatDigits(MY_REMINDER_MAX_LENGTH), n: formatDigits(MY_REMINDERS_MAX) }));
      return;
    }
    myRemindersStore.update((value) => addMyReminder(value, text, newUuid(), new Date().toISOString()));
    setText('');
    setError(null);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm leading-7 text-muted-foreground">
        {t('lead')} {t('deviceOnly')}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        noValidate
      >
        <label htmlFor={inputId} className="text-sm font-medium">
          {t('newLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={inputId}
            className="h-11 min-w-0 flex-1"
            maxLength={MY_REMINDER_MAX_LENGTH}
            value={text}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={list.length >= MY_REMINDERS_MAX}>
            {t('add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('count', { n: formatDigits(list.length), max: formatDigits(MY_REMINDERS_MAX) })}
        </p>
        {error ? (
          <p id={errorId} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      {list.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {list.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <p className="text-base leading-8">{item.text}</p>
              <Button size="sm" variant="ghost" tone="neutral" onClick={() => myRemindersStore.update((value) => removeMyReminder(value, item.id))}>
                {t('remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
