/**
 * «لحظة مجاهدة» (was «لحظة ضعف»; owner round 3, item 15; the route keeps its name `moment`). Which program it is about
 * comes from the device (practice-core `momentProgram`: the program in focus, or a sin page's in-memory hand-off, never
 * a route param). The requests are the same for every user: the practice catalog and the texts by id.
 *
 * Top to bottom: the ten-minute ring; «افعل واحدة الآن» first: two tools that open a sheet each («سبّح الآن»: the tasbih
 * counter with the timer and the reward arithmetic; «وردٌ أقصر»: a smaller amount of today's habits, logged now, and the
 * nafl prayer sitting), then «أو علّم ما فعلت» (ticks that only mark, nothing else); one verse passage on patience
 * and striving, rotating (catalog `mujahada.verses`; never «قل يا عبادي الذين أسرفوا» here), and a scholar's saying when
 * the catalog has one; then «كيف كانت مجاهدتك؟»: «ثبتُّ بفضل الله» marks «ثبتّ» for today when the day has no check-in
 * yet, «زلّت قدمي» offers «صلّحها الآن». Healthy words only: a slip is a slip, never «وقعت».
 *
 * Privacy: SinProgramGuard (the vault opened on the device, the cover in the app switcher). Screenshots are allowed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, HandHeart, ListChecks, type LucideIcon } from 'lucide-react-native';
import { formatCountdown, momentProgram, recordWavePassed, urgeProgress, urgeTextIndex } from '@thekra/practice-core';
import { QuoteCard } from '@/components/QuoteCard';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
import { FixItSheet } from '@/components/practice/sin/FixItSheet';
import { ProgressRing } from '@/components/practice/sin/ProgressRing';
import { MinimumWirdSheet } from '@/components/practice/mujahada/MinimumWirdSheet';
import { TasbihSheet } from '@/components/practice/mujahada/TasbihSheet';
import { useEvidence, usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { mujahadaPassage } from '@/lib/practice/mujahada';
import { momentSource, today, usePracticeStore } from '@/lib/practice/practice-store';
import { programEntry } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Chip, ForwardChevron, Icon, NextStep, Ornament, PageHeader, Screen, Section, Text, Wrap } from '@/ui';

const TICK_MS = 1000;
/** «أو علّم ما فعلت»: ticks only (owner: no option that opens the phone with no number or goal). */
const MARKS = ['wudu', 'move', 'call'] as const;
type Mark = (typeof MARKS)[number];

const makeStyles = (t: Theme) => ({
  center: { alignItems: 'center' as const, gap: space.xs },
  tools: { gap: space.sm },
  tool: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 72,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.ring,
    backgroundColor: t.colors.card,
  },
  toolPressed: { backgroundColor: t.colors.accent },
  toolTexts: { flex: 1, gap: 2 },
  verse: { gap: space.sm, alignItems: 'center' as const },
  answers: { gap: space.sm },
});

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;

export default function MujahadaMomentScreen() {
  return (
    <SinProgramGuard>
      <MujahadaContent />
    </SinProgramGuard>
  );
}

function ToolCard({ icon, title, hint, onPress }: { icon: LucideIcon; title: string; hint: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      android_ripple={{ color: colors.accent }}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
    >
      <Icon icon={icon} size={26} tone="link" strokeWidth={1.4} />
      <View style={styles.toolTexts}>
        <Text variant="heading">{title}</Text>
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      </View>
      <ForwardChevron size={18} tone="link" />
    </Pressable>
  );
}

function MujahadaContent() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const mujahada = catalog.data?.mujahada;
  // Read once: the hand-off of the screen that opened this one.
  const [source] = useState(momentSource);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [marks, setMarks] = useState<ReadonlySet<Mark>>(() => new Set());
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [tool, setTool] = useState<'tasbih' | 'wird' | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const d = today();
  const elapsed = (now - startedAt) / 1000;
  const program = useMemo(() => momentProgram(programs, source, d), [programs, source, d]);
  const sinPrograms = catalog.data?.sinPrograms;
  // Every sin can run «تخفَّف»: a sin without a written program has the common entry (programEntry).
  const entry = program && sinPrograms ? (programEntry(sinPrograms.programs, program.sinSlug, program.category) ?? undefined) : undefined;
  const common = sinPrograms?.common;
  const passage = mujahadaPassage(mujahada?.verses, d, elapsed);
  const sayings = mujahada?.sayings ?? [];
  const sayingId = sayings.length > 0 ? sayings[urgeTextIndex(sayings.length, d, elapsed)] : undefined;
  const texts = useEvidence([...(passage ?? []), ...(sayingId ? [sayingId] : [])], locale);
  const verses = (passage ?? []).flatMap((id) => texts.data?.get(id) ?? []);
  const saying = sayingId ? texts.data?.get(sayingId) : undefined;
  const progress = urgeProgress(startedAt, now);
  const asking = progress.done || early;
  const canFix = Boolean(program && entry && common);

  function toggle(mark: Mark) {
    setMarks((current) => {
      const next = new Set(current);
      if (next.has(mark)) next.delete(mark);
      else next.add(mark);
      return next;
    });
  }

  function answerHeld() {
    if (!program) {
      setOutcome({ kind: 'held', result: 'none' });
      return;
    }
    const hadDay = program.checkIns.some((c) => c.date === d);
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (p.sinSlug === program.sinSlug ? recordWavePassed(p, d) : p)) }));
    setOutcome({ kind: 'held', result: hadDay ? 'kept' : 'saved' });
  }

  function answerSlipped() {
    setOutcome({ kind: 'slipped' });
    if (canFix) setFixOpen(true);
  }

  const first = verses[0];
  const surah = first?.quran ? (locale === 'en' ? first.quran.surahName || first.quran.surahNameAr : first.quran.surahNameAr) : null;
  const ayahs = verses.map((v) => v.quran?.ayahNumber).filter((n): n is number => typeof n === 'number');
  const ayahLabel = ayahs.length > 1 ? `${ayahs[0]}-${ayahs[ayahs.length - 1]}` : ayahs[0] !== undefined ? String(ayahs[0]) : null;

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('sinProgram.moment.title')} lead={t('sinProgram.moment.lead')} />

      <ProgressRing fraction={progress.fraction} label={t('sinProgram.moment.remaining', { time: formatCountdown(progress.remaining) })}>
        <View style={styles.center} importantForAccessibility="no-hide-descendants">
          <Text variant="display">{formatCountdown(progress.remaining)}</Text>
          <Text variant="caption" tone="muted" align="center">
            {t('sinProgram.moment.timer')}
          </Text>
        </View>
      </ProgressRing>

      <Section title={t('sinProgram.moment.actionsTitle')}>
        <View style={styles.tools}>
          <ToolCard icon={HandHeart} title={t('mujahada.tools.tasbih')} hint={t('mujahada.tools.tasbihHint')} onPress={() => setTool('tasbih')} />
          <ToolCard icon={ListChecks} title={t('mujahada.tools.wird')} hint={t('mujahada.tools.wirdHint')} onPress={() => setTool('wird')} />
        </View>
        <Text variant="small" weight="medium" tone="muted">
          {t('mujahada.marksLabel')}
        </Text>
        <Wrap>
          {MARKS.map((mark) => (
            <Chip key={mark} label={t(`mujahada.marks.${mark}`)} selected={marks.has(mark)} onPress={() => toggle(mark)} />
          ))}
        </Wrap>
      </Section>

      {verses.length > 0 ? (
        <>
          <Ornament />
          <View style={styles.verse} accessible accessibilityLabel={verses.map((v) => v.textAr).join(' ')}>
            <Text variant="quran" align="center">{`﴿${verses.map((v) => v.textAr).join(' ۝ ')}﴾`}</Text>
            {locale === 'en'
              ? verses.map((v) =>
                  v.translation?.text ? (
                    <Text key={v.id} variant="small" tone="muted" align="center">
                      {v.translation.text}
                    </Text>
                  ) : null,
                )
              : null}
            {surah && ayahLabel ? (
              <Text variant="caption" tone="muted">
                {t('sinProgram.moment.verseCitation', { surah, chapter: String(first?.quran?.surahNumber ?? ''), ayah: ayahLabel })}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
      {saying ? <QuoteCard quote={saying} shareable={false} /> : null}

      <Ornament />

      {outcome?.kind === 'held' ? (
        <NextStep title={t('sinProgram.moment.heldTitle')}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Icon icon={Check} size={16} tone="link" />
            <Text variant="small">
              {outcome.result === 'saved'
                ? t('sinProgram.moment.heldSaved')
                : outcome.result === 'kept'
                  ? t('sinProgram.moment.heldKept')
                  : t('sinProgram.moment.heldNoProgram')}
            </Text>
          </View>
        </NextStep>
      ) : outcome?.kind === 'slipped' ? (
        <Section title={t('sinProgram.moment.slipTitle')}>
          <Text variant="body">{t('sinProgram.moment.slipBody')}</Text>
          {canFix ? <Button label={t('sinProgram.moment.fix')} onPress={() => setFixOpen(true)} /> : null}
        </Section>
      ) : asking ? (
        <Section title={t('sinProgram.moment.question')}>
          <View style={styles.answers}>
            <Button label={t('sinProgram.moment.yes')} onPress={answerHeld} large block />
            <Button label={t('sinProgram.moment.no')} onPress={answerSlipped} variant="outline" block />
          </View>
        </Section>
      ) : (
        <Button label={t('sinProgram.moment.answerEarly')} onPress={() => setEarly(true)} variant="ghost" />
      )}

      {program ? <Button label={t('sinProgram.moment.back')} onPress={() => router.replace('/practice/sin-program')} variant="ghost" arrow /> : null}

      <TasbihSheet
        visible={tool === 'tasbih'}
        onClose={() => setTool(null)}
        remaining={progress.remaining}
        multiplierHadith={mujahada?.multiplierHadith}
      />
      <MinimumWirdSheet visible={tool === 'wird'} onClose={() => setTool(null)} sittingPrayerHadith={mujahada?.sittingPrayerHadith} />
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
