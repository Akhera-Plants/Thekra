/**
 * «لحظة ضعف» (redesign phase 3). LOCAL ONLY: which program it is about comes from the device (practice-core
 * `momentProgram`: the program in focus, or a sin page's in-memory hand-off, never a route param). The requests are the
 * same for every user: the stored verse Al-A'raf 7:201 (content rule §3.1), the catalog and the evidence of ALL
 * programs at once. The native title stays generic (practice/_layout.tsx).
 *
 * A ten-minute ring, one rotating text, one-tap ticks (on this screen only; «اتصل بأحد» also opens the phone dialer
 * with no number), then «عبرت الموجة؟»: yes marks «ثبتّ» for today when the day has no check-in yet; no opens
 * «خربانة؟ صلّحها». Without a program nothing is stored and nothing personal is shown.
 *
 * Privacy: SinProgramGuard (device lock if chosen, cover in the app switcher, screenshots blocked).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import {
  formatCountdown,
  momentProgram,
  recordWavePassed,
  URGE_ACTIONS,
  urgeProgress,
  urgeTextIds,
  urgeTextIndex,
  type UrgeAction,
} from '@thekra/practice-core';
import { QuoteCard } from '@/components/QuoteCard';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
import { FixItSheet } from '@/components/practice/sin/FixItSheet';
import { ProgressRing } from '@/components/practice/sin/ProgressRing';
import { usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { useAyah } from '@/lib/api/quran';
import { pick } from '@/lib/practice/catalog-types';
import { momentSource, today, usePracticeStore } from '@/lib/practice/practice-store';
import { programEntry } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles } from '@/theme';
import { Button, Chip, Notice, PageHeader, Screen, Section, Text } from '@/ui';

const TICK_MS = 1000;

const makeStyles = () => ({
  verse: { gap: space.xs, alignItems: 'center' as const },
  center: { alignItems: 'center' as const, gap: space.xs },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  answers: { gap: space.sm },
});

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;

export default function WeakMomentScreen() {
  return (
    <SinProgramGuard>
      <WeakMomentContent />
    </SinProgramGuard>
  );
}

function WeakMomentContent() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const verse = useAyah(7, 201, locale);
  // Read once: the hand-off of the screen that opened this one.
  const [source] = useState(momentSource);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [ticks, setTicks] = useState<ReadonlySet<UrgeAction>>(() => new Set());
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const d = today();
  const program = useMemo(() => momentProgram(programs, source, d), [programs, source, d]);
  const sinPrograms = catalog.data?.sinPrograms;
  // Every sin can run «تخفَّف»: a sin without a written program has the common entry (programEntry).
  const entry = program && sinPrograms ? (programEntry(sinPrograms.programs, program.sinSlug, program.category) ?? undefined) : undefined;
  const common = sinPrograms?.common;
  const commonIds = common ? [...(common.afterFall.evidence ?? []), ...(common.stages.harms?.evidence ?? [])] : [];
  const texts = urgeTextIds(entry?.evidence, commonIds).flatMap((id) => evidence.data?.get(id) ?? []);
  const textIndex = urgeTextIndex(texts.length, d, (now - startedAt) / 1000);
  const text = textIndex >= 0 ? texts[textIndex] : undefined;
  const progress = urgeProgress(startedAt, now);
  const asking = progress.done || early;
  const canFix = Boolean(program && entry && common);

  function toggle(action: UrgeAction) {
    const on = ticks.has(action);
    setTicks((current) => {
      const next = new Set(current);
      if (on) next.delete(action);
      else next.add(action);
      return next;
    });
    // The dialer opens with no number: the user picks whom to call.
    if (action === 'call' && !on) void Linking.openURL('tel:').catch(() => undefined);
  }

  function answerYes() {
    if (!program) {
      setOutcome({ kind: 'held', result: 'none' });
      return;
    }
    const hadDay = program.checkIns.some((c) => c.date === d);
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (p.sinSlug === program.sinSlug ? recordWavePassed(p, d) : p)) }));
    setOutcome({ kind: 'held', result: hadDay ? 'kept' : 'saved' });
  }

  function answerNo() {
    setOutcome({ kind: 'slipped' });
    if (canFix) setFixOpen(true);
  }

  const v = verse.data;
  const surah = v?.quran ? (locale === 'en' ? v.quran.surahName : v.quran.surahNameAr) : null;
  const verseEnglish = locale === 'en' ? v?.translation?.text?.trim() : undefined;

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('sinProgram.moment.title')} lead={t('sinProgram.moment.lead')} />

      {v ? (
        <View style={styles.verse}>
          <Text variant="quran" align="center">{`﴿${v.textAr}﴾`}</Text>
          {verseEnglish ? (
            <Text variant="small" tone="muted" align="center">
              {verseEnglish}
            </Text>
          ) : null}
          {surah && v.quran?.ayahNumber != null ? (
            <Text variant="caption" tone="muted">
              {t('sinProgram.moment.verseCitation', { surah, chapter: String(v.quran.surahNumber ?? 7), ayah: String(v.quran.ayahNumber) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ProgressRing fraction={progress.fraction} label={t('sinProgram.moment.remaining', { time: formatCountdown(progress.remaining) })}>
        <View style={styles.center} importantForAccessibility="no-hide-descendants">
          <Text variant="display">{formatCountdown(progress.remaining)}</Text>
          <Text variant="caption" tone="muted" align="center">
            {t('sinProgram.moment.timer')}
          </Text>
        </View>
      </ProgressRing>

      {text ? <QuoteCard quote={text} shareable={false} /> : null}

      <Section title={t('sinProgram.moment.actionsTitle')}>
        <View style={styles.chips}>
          {URGE_ACTIONS.map((action) => (
            <Chip key={action} label={t(`sinProgram.moment.actions.${action}`)} selected={ticks.has(action)} onPress={() => toggle(action)} />
          ))}
        </View>
        <Text variant="caption" tone="muted">
          {t('sinProgram.moment.callHint')}
        </Text>
      </Section>

      {outcome?.kind === 'held' ? (
        <Notice icon={Check}>
          {outcome.result === 'saved'
            ? t('sinProgram.moment.heldSaved')
            : outcome.result === 'kept'
              ? t('sinProgram.moment.heldKept')
              : t('sinProgram.moment.heldNoProgram')}
        </Notice>
      ) : outcome?.kind === 'slipped' && !canFix && common ? (
        <Section title={pick(common.afterFall, 'title', locale)}>
          <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(common.afterFall, 'body', locale)}</Text>
        </Section>
      ) : asking ? (
        <Section title={t('sinProgram.moment.question')}>
          <View style={styles.answers}>
            <Button label={t('sinProgram.moment.yes')} onPress={answerYes} large block />
            <Button label={t('sinProgram.moment.no')} onPress={answerNo} variant="outline" block />
          </View>
        </Section>
      ) : (
        <Button label={t('sinProgram.moment.answerEarly')} onPress={() => setEarly(true)} variant="ghost" />
      )}

      {outcome?.kind === 'slipped' && canFix && common ? (
        <Button label={pick(common.afterFall, 'title', locale)} onPress={() => setFixOpen(true)} variant="outline" />
      ) : null}
      {program ? <Button label={t('sinProgram.moment.back')} onPress={() => router.replace('/practice/sin-program')} variant="ghost" arrow /> : null}

      {program && entry && common ? (
        <FixItSheet
          visible={fixOpen}
          onClose={() => setFixOpen(false)}
          program={program}
          entry={entry}
          common={common}
          habits={catalog.data?.habits ?? []}
          evidenceById={evidence.data}
          today={d}
        />
      ) : null}
    </Screen>
  );
}
