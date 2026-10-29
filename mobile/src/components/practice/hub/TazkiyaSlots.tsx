/**
 * Where the tazkiya cards sit on the hub, with their hooks (use-tazkiya.ts):
 * - `TazkiyaPromptSlot` at the top: the intention in the morning, the evening reckoning after Maghrib (or 18:00);
 * - `FreshStartSlot` under the day list: at most one fresh-start card a day.
 * Both render nothing until the catalog's words and the private journal are loaded. Saving writes only to the
 * device journal (tazkiya-store.ts).
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookHeart } from 'lucide-react-native';
import { intendedPlan, type LocalDate } from '@thekra/practice-core';
import { pick } from '@/lib/practice/catalog-types';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import {
  useDuePrompt,
  useFreshStartCard,
  useJournal,
  useJournalActions,
  useTazkiyaPrompts,
} from '@/lib/practice/use-tazkiya';
import { Notice } from '@/ui';
import { EveningCard, FreshStartCard, NiyyahCard, type NiyyahChoice } from './TazkiyaCards';

const openMuhasaba = () => router.push('/practice/muhasaba');

export interface TazkiyaPromptSlotProps {
  /** Today's habits, for the intention. */
  choices: NiyyahChoice[];
  /** Anything started (the evening card is for people with a track). */
  started: boolean;
}

export function TazkiyaPromptSlot({ choices, started }: TazkiyaPromptSlotProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const prompts = useTazkiyaPrompts();
  const { prompt, date } = useDuePrompt(choices.length > 0, started);
  const { saveNiyyah, saveMuhasaba, setPromptAside } = useJournalActions();
  const [thanked, setThanked] = useState(false);

  const handleNiyyah = useCallback(
    (choice: NiyyahChoice, note: string) => saveNiyyah(date, choice.planId, choice.title, note),
    [saveNiyyah, date],
  );
  const handleThanks = useCallback(() => {
    saveMuhasaba(date, {}, true);
    setThanked(true);
  }, [saveMuhasaba, date]);
  const handleNotNow = useCallback(() => {
    if (prompt) setPromptAside(prompt, date);
  }, [prompt, date, setPromptAside]);

  if (thanked) {
    return (
      <View accessibilityLiveRegion="polite">
        <Notice icon={BookHeart}>{t('tazkiya.eveningSaved')}</Notice>
      </View>
    );
  }
  if (!prompts || !prompt) return null;
  if (prompt === 'niyyah') {
    return <NiyyahCard intro={pick(prompts.niyyah, 'intro', locale)} choices={choices} onSave={handleNiyyah} onNotNow={handleNotNow} />;
  }
  return (
    <EveningCard
      intro={pick(prompts.muhasaba, 'intro', locale)}
      thanks={pick(prompts.muhasaba, 'thanks', locale)}
      onThanks={handleThanks}
      onWrite={openMuhasaba}
      onNotNow={handleNotNow}
    />
  );
}

export interface FreshStartSlotProps {
  today: LocalDate;
  choices: NiyyahChoice[];
}

export function FreshStartSlot({ today, choices }: FreshStartSlotProps) {
  const locale = useUiLocale();
  const card = useFreshStartCard(today);
  const { journal } = useJournal();
  const { saveNiyyah, setAside } = useJournalActions();
  const [renewing, setRenewing] = useState(false);

  const canRenew = choices.length > 0 && intendedPlan(journal, today) === null;
  const action = card?.action;
  const handleRenew = useCallback(() => setRenewing(true), []);
  const handleRenewClose = useCallback(() => setRenewing(false), []);
  const handleNotNow = useCallback(() => {
    if (card) setAside(card.key);
  }, [card, setAside]);
  const handleRenewSave = useCallback(
    (choice: NiyyahChoice, note: string) => {
      saveNiyyah(today, choice.planId, choice.title, note);
      if (card) setAside(card.key);
      setRenewing(false);
    },
    [saveNiyyah, setAside, today, card],
  );
  const handleStep = useCallback(() => {
    if (action?.kind === 'increase') router.push(`/practice/plan/${action.planId}`);
    else if (action?.kind === 'start') router.push('/practice/add');
  }, [action]);

  if (!card) return null;
  if (renewing && canRenew) {
    return (
      <NiyyahCard intro={pick(card.text, 'body', locale)} choices={choices} onSave={handleRenewSave} onNotNow={handleRenewClose} />
    );
  }
  const stepLabel =
    card.action.kind === 'increase'
      ? pick(card.labels, 'increase', locale)
      : card.action.kind === 'start'
        ? pick(card.labels, 'start', locale)
        : undefined;
  return (
    <FreshStartCard
      title={pick(card.text, 'title', locale)}
      body={pick(card.text, 'body', locale)}
      renewLabel={pick(card.labels, 'renew', locale)}
      onRenew={canRenew ? handleRenew : undefined}
      stepLabel={stepLabel}
      onStep={stepLabel ? handleStep : undefined}
      onNotNow={handleNotNow}
    />
  );
}
