'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addMyReminder,
  MY_REMINDER_MAX_LENGTH,
  MY_REMINDERS_MAX,
  myReminderError,
  removeMyReminder,
  type MyReminder,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import { RowMenu } from '@/features/practice/components/RowMenu';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { formatDigits } from '@/lib/format/digits';
import { newUuid } from '@/lib/practice/ids';
import { myRemindersStore, useMyReminders } from '@/lib/practice/screen-stores';

/**
 * «تذكيراتي», the second tab of «المحفوظات» (owner round 5, F-22 a / W-30: the only place they are written, on the web
 * and in the app; mobile/src/components/practice/MyRemindersPanel.tsx): the member's own short lines, kept on this
 * browser only («على جهازي فقط», the only mode for now). At most {@link MY_REMINDERS_MAX} lines of
 * {@link MY_REMINDER_MAX_LENGTH} characters. Adding says so in a toast; each line's «احذف» is behind its «⋯», confirmed,
 * then a toast with «تراجع» (round-4 rule: no destructive link under each item).
 */
export function MyRemindersPanel() {
  const t = useTranslations('practice.myReminders');
  const list = useMyReminders();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const countId = useId();
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
    toast.success(t('addedToast'));
  }

  function remove(item: MyReminder) {
    const before = myRemindersStore.get();
    myRemindersStore.update((value) => removeMyReminder(value, item.id));
    toast(t('removedToast'), { action: { label: t('undo'), onClick: () => myRemindersStore.update(() => before) } });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
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
        {/* The field and its «أضف» on one line, the same height (A-07). */}
        <div className="flex gap-2">
          <Input
            id={inputId}
            className="h-11 min-w-0 flex-1"
            maxLength={MY_REMINDER_MAX_LENGTH}
            value={text}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${countId}` : countId}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" size="md" disabled={list.length >= MY_REMINDERS_MAX}>
            {t('add')}
          </Button>
        </div>
        <p id={countId} className="text-xs text-muted-foreground">
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
        <ul className="flex flex-col divide-y divide-border">
          {list.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <p className="min-w-0 text-base leading-8 break-words">{item.text}</p>
              <RowMenu
                label={t('optionsOf', { text: item.text })}
                remove={{
                  label: t('remove'),
                  confirmTitle: t('removeTitle'),
                  note: item.text,
                  confirm: t('removeConfirm'),
                  keep: t('keep'),
                  onConfirm: () => remove(item),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
