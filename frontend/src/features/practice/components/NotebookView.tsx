'use client';

import { useState } from 'react';
import { BookHeart, HandHeart, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { MUHASABA_QUESTIONS, deleteDay, notebook, type JournalDay } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGregorian } from '@/lib/practice/format';
import { clearJournal, updateJournal } from '@/lib/practice/tazkiya-journal';
import type { TazkiyaPrompts } from '@/lib/types/practice';
import { useHijriLabel } from '../hooks/useHijriLabel';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useTazkiyaJournal } from '../hooks/useTazkiyaJournal';

/**
 * «دفتر المحاسبة» (proposals item 5): every written day, newest first: the morning intention and the evening answers
 * under the catalog's questions. This browser only (tazkiya-journal.ts). A day, or the whole notebook, can be deleted
 * after a confirmation; it cannot be recovered.
 */
export function NotebookView() {
  const t = useTranslations('tazkiya');
  const journal = useTazkiyaJournal();
  const catalog = usePracticeCatalog();
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);

  if (!journal) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  const days = notebook(journal);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm leading-7 text-muted-foreground">{t('notebookPrivate')}</p>
      {days.length === 0 ? (
        <div className="empty-state">
          <BookHeart aria-hidden />
          <p>{t('notebookEmpty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {days.map((day) => (
            <NotebookDay key={day.date} day={day} prompts={catalog.data?.tazkiya} />
          ))}
        </ul>
      )}
      {days.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {isConfirmingAll ? (
            <>
              <p className="w-full text-sm text-muted-foreground">{t('deleteAllConfirm')}</p>
              <Button variant="outline" tone="destructive" size="sm" onClick={clearJournal}>
                {t('confirmDelete')}
              </Button>
              <Button variant="ghost" tone="neutral" size="sm" onClick={() => setIsConfirmingAll(false)}>
                {t('keep')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" tone="neutral" size="sm" onClick={() => setIsConfirmingAll(true)}>
              <Trash2 aria-hidden />
              {t('deleteAll')}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotebookDay({ day, prompts }: { day: JournalDay; prompts: TazkiyaPrompts | undefined }) {
  const t = useTranslations('tazkiya');
  const english = useLocale() === 'en';
  const hijri = useHijriLabel();
  const offset = usePracticeStore()?.store.settings.hijriOffset ?? 0;
  const [isConfirming, setIsConfirming] = useState(false);
  const hijriLabel = hijri(day.date, offset);

  return (
    <li className="flex flex-col gap-3 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          {formatGregorian(day.date, english ? 'en' : 'ar', true)}
          {hijriLabel ? <span className="ms-2 text-sm font-normal text-muted-foreground">{hijriLabel}</span> : null}
        </h2>
        {isConfirming ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('deleteDayConfirm')}</span>
            <Button variant="outline" tone="destructive" size="sm" onClick={() => updateJournal((j) => deleteDay(j, day.date))}>
              {t('confirmDelete')}
            </Button>
            <Button variant="ghost" tone="neutral" size="sm" onClick={() => setIsConfirming(false)}>
              {t('keep')}
            </Button>
          </span>
        ) : (
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setIsConfirming(true)}>
            <Trash2 aria-hidden />
            {t('deleteDay')}
          </Button>
        )}
      </div>
      {day.niyyah ? (
        <p className="flex items-start gap-2 text-base leading-8">
          <HandHeart className="mt-2 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium">
              {t('niyyahLabel')}: <bdi>{day.niyyah.title}</bdi>
            </span>
            {day.niyyah.note ? <span dir="auto" className="block text-sm text-muted-foreground">{day.niyyah.note}</span> : null}
          </span>
        </p>
      ) : null}
      {day.muhasaba ? (
        <dl className="flex flex-col gap-2">
          {MUHASABA_QUESTIONS.map((key) => {
            const answer = day.muhasaba?.answers[key];
            if (!answer) return null;
            const question = prompts?.muhasaba.questions.find((q) => q.key === key);
            return (
              <div key={key}>
                {question ? <dt className="text-sm text-muted-foreground">{english ? question.textEn : question.textAr}</dt> : null}
                <dd dir="auto" className="text-base leading-8 whitespace-pre-line">{answer}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {day.muhasaba?.thanked && prompts ? (
        <p className="text-sm font-medium text-primary">{english ? prompts.muhasaba.thanksEn : prompts.muhasaba.thanksAr}</p>
      ) : null}
    </li>
  );
}
