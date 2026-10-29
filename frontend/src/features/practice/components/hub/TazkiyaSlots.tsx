'use client';

import { useState } from 'react';
import { BookHeart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  dismiss,
  duePrompt,
  freshStartAction,
  freshStartFor,
  freshStartKey,
  intendedPlan,
  promptKey,
  setMuhasaba,
  setNiyyah,
  type Plan,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { updateJournal } from '@/lib/practice/tazkiya-journal';
import type { TazkiyaPrompts } from '@/lib/types/practice';
import { useTazkiyaJournal } from '../../hooks/useTazkiyaJournal';
import { useToday } from '../../hooks/useToday';
import { EveningCard, FreshStartCard, NiyyahCard, type NiyyahChoice } from './TazkiyaCards';

/**
 * Where the tazkiya cards sit on the hub (proposals items 5 and 6): the intention in the morning and the evening
 * reckoning after 18:00 at the top (practice-core `duePrompt`), and at most one fresh-start card under today's list
 * (`freshStartFor` with the user's Hijri offset). Both render nothing until the catalog's words and the device
 * journal are there. Saving writes only to this browser (tazkiya-journal.ts).
 */
type Bilingual = Record<string, unknown>;

function inLocale<T extends Bilingual>(entry: T, key: string, english: boolean): string {
  const ar = entry[`${key}Ar`];
  const en = entry[`${key}En`];
  return String((english && typeof en === 'string' && en) || ar || '');
}

function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

interface TazkiyaPromptSlotProps {
  prompts: TazkiyaPrompts | undefined;
  choices: NiyyahChoice[];
  isStarted: boolean;
}

export function TazkiyaPromptSlot({ prompts, choices, isStarted }: TazkiyaPromptSlotProps) {
  const t = useTranslations('tazkiya');
  const english = useLocale() === 'en';
  const journal = useTazkiyaJournal();
  const clock = useToday();
  const [isSaved, setIsSaved] = useState(false);

  if (isSaved) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-primary">
        <BookHeart className="size-4" aria-hidden />
        {t('eveningSaved')}
      </p>
    );
  }
  if (!prompts || !journal || !clock) return null;
  const date = clock.today;
  const prompt = duePrompt(journal, { date, time: clockTime(clock.minutes), hasHabitsToday: choices.length > 0, started: isStarted });
  if (!prompt) return null;
  const setAside = () => updateJournal((j) => dismiss(j, promptKey(prompt, date)));

  if (prompt === 'niyyah') {
    return (
      <NiyyahCard
        intro={inLocale(prompts.niyyah, 'intro', english)}
        choices={choices}
        onSave={(choice, note) => updateJournal((j) => setNiyyah(j, date, { planId: choice.planId, title: choice.title, note }))}
        onNotNow={setAside}
      />
    );
  }
  return (
    <EveningCard
      intro={inLocale(prompts.muhasaba, 'intro', english)}
      thanks={inLocale(prompts.muhasaba, 'thanks', english)}
      questions={prompts.muhasaba.questions.map((q) => ({ key: q.key, text: inLocale(q, 'text', english) }))}
      onSave={(answers, thanked) => {
        updateJournal((j) => setMuhasaba(j, date, { answers, thanked }));
        setIsSaved(true);
      }}
      onNotNow={setAside}
    />
  );
}

interface FreshStartSlotProps {
  prompts: TazkiyaPrompts | undefined;
  today: string;
  hijriOffset: number;
  plans: readonly Plan[];
  choices: NiyyahChoice[];
}

export function FreshStartSlot({ prompts, today, hijriOffset, plans, choices }: FreshStartSlotProps) {
  const english = useLocale() === 'en';
  const journal = useTazkiyaJournal();
  const [isRenewing, setIsRenewing] = useState(false);
  if (!prompts || !journal) return null;
  const start = freshStartFor(today, hijriOffset, journal.dismissed);
  const text = start ? prompts.freshStarts.occasions.find((o) => o.kind === start.kind) : undefined;
  if (!start || !text) return null;

  const key = freshStartKey(start);
  const labels = prompts.freshStarts;
  const canRenew = choices.length > 0 && intendedPlan(journal, today) === null;
  const action = freshStartAction(plans, today);
  const step =
    action.kind === 'increase'
      ? { label: inLocale(labels, 'increase', english), href: `/practice/habits#plan-${action.planId}` }
      : action.kind === 'start'
        ? { label: inLocale(labels, 'start', english), href: '/practice/habits' }
        : undefined;

  if (isRenewing && canRenew) {
    return (
      <NiyyahCard
        intro={inLocale(text, 'body', english)}
        choices={choices}
        onSave={(choice, note) =>
          updateJournal((j) => dismiss(setNiyyah(j, today, { planId: choice.planId, title: choice.title, note }), key))
        }
        onNotNow={() => setIsRenewing(false)}
      />
    );
  }
  return (
    <FreshStartCard
      title={inLocale(text, 'title', english)}
      body={inLocale(text, 'body', english)}
      renewLabel={inLocale(labels, 'renew', english)}
      onRenew={canRenew ? () => setIsRenewing(true) : undefined}
      step={step}
      onNotNow={() => updateJournal((j) => dismiss(j, key))}
    />
  );
}

/** «دفتر المحاسبة»: the device-only notebook. */
export function NotebookLink() {
  const t = useTranslations('tazkiya');
  return (
    <Link href="/practice/notebook" className="text-link inline-flex items-center gap-2 self-start text-sm">
      <BookHeart className="size-4" aria-hidden />
      {t('notebookTitle')} <DirectionalArrow />
    </Link>
  );
}
