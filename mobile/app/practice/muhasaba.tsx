/**
 * «محاسبة المساء» (proposals item 5): the catalog's three questions, each free text and optional, and
 * «الحمد لله على ما كان». Saving writes today's entry to the device journal only (tazkiya-store.ts) and returns to the
 * hub; an entry already written today opens filled in. Nothing here is synced or sent anywhere.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MUHASABA_ANSWER_MAX, journalDay, validateMuhasaba, type MuhasabaQuestion } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type TazkiyaPrompts } from '@/lib/practice/catalog-types';
import { today } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useJournal, useJournalActions } from '@/lib/practice/use-tazkiya';
import { Button, CheckRow, ErrorState, Field, Loading, Notice, PageHeader, Screen, TextLink, Wrap } from '@/ui';

type Answers = Partial<Record<MuhasabaQuestion, string>>;

const openNotebook = () => router.replace('/practice/notebook');

export default function MuhasabaScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const { hydrated, journal } = useJournal();
  const date = today();

  if (!hydrated || catalog.isLoading) return <Loading />;
  const prompts = catalog.data?.tazkiya;
  if (!prompts) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />
      </Screen>
    );
  }
  const entry = journalDay(journal, date)?.muhasaba;
  return <MuhasabaForm prompts={prompts} date={date} initialAnswers={entry?.answers ?? {}} initialThanked={entry?.thanked ?? false} />;
}

const AnswerField = memo(function AnswerField({
  question,
  label,
  value,
  onChange,
}: {
  question: MuhasabaQuestion;
  label: string;
  value: string;
  onChange: (question: MuhasabaQuestion, text: string) => void;
}) {
  const handleChange = useCallback((text: string) => onChange(question, text), [onChange, question]);
  return (
    <Field
      label={label}
      value={value}
      onChangeText={handleChange}
      multiline
      maxLength={MUHASABA_ANSWER_MAX}
      autoComplete="off"
      textContentType="none"
      textAlignVertical="top"
    />
  );
});

interface MuhasabaFormProps {
  prompts: TazkiyaPrompts;
  date: string;
  initialAnswers: Answers;
  initialThanked: boolean;
}

function MuhasabaForm({ prompts, date, initialAnswers, initialThanked }: MuhasabaFormProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const { saveMuhasaba } = useJournalActions();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [thanked, setThanked] = useState(initialThanked);
  const canSave = useMemo(() => validateMuhasaba({ answers, thanked }) === null, [answers, thanked]);

  const handleAnswer = useCallback((question: MuhasabaQuestion, text: string) => {
    setAnswers((prev) => ({ ...prev, [question]: text }));
  }, []);
  const handleThanks = useCallback(() => setThanked((on) => !on), []);
  const handleSave = useCallback(() => {
    saveMuhasaba(date, answers, thanked);
    router.back();
  }, [saveMuhasaba, date, answers, thanked]);

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('tazkiya.eveningTitle')} lead={pick(prompts.muhasaba, 'intro', locale)} />
      {prompts.muhasaba.questions.map((q) => (
        <AnswerField key={q.key} question={q.key} label={pick(q, 'text', locale)} value={answers[q.key] ?? ''} onChange={handleAnswer} />
      ))}
      <CheckRow title={pick(prompts.muhasaba, 'thanks', locale)} checked={thanked} onPress={handleThanks} />
      <Notice>{t('tazkiya.notebookPrivate')}</Notice>
      <Wrap>
        <Button label={t('tazkiya.eveningSave')} onPress={handleSave} disabled={!canSave} />
        <TextLink label={t('tazkiya.notebookTitle')} onPress={openNotebook} muted />
      </Wrap>
    </Screen>
  );
}
