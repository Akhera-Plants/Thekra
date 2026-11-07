/**
 * «لحظة مجاهدة» (was «لحظة ضعف»; owner round 3, item 15; round 5, F-09 / F-12; the route keeps its name `moment`).
 * Which program it is about comes from the device only (practice-core `momentProgram`: a sin page's or «تخفَّف»'s
 * in-memory hand-off, never a route param); opened from the app header or the widget with several programs running,
 * a short chooser asks which one. The requests are the same for every user: the catalog, the evidence of EVERY act
 * of every sin at once (`useMomentEvidence`) and the public sins list for the names.
 *
 * Top to bottom: the ten-minute ring; «افعل واحدة الآن»: the acts tied to the texts for this sin (catalog
 * `sinPrograms.moment`, e.g. anger: seek refuge, sit down, hold back, speak good or stay silent), each with a small
 * «الدليل» that opens its texts in a sheet; the generic acts when the sin has none of its own or no program is known;
 * then «أدوات تعينك» (the tasbih counter, «وردٌ أقصر», «أعمال سهلة»), the «اركب الموجة» strategy in its moment (F-12);
 * one verse passage on patience, rotating; then «كيف كانت مجاهدتك؟». Healthy words only: a slip is a slip.
 *
 * Privacy: SinProgramGuard (the vault opened on the device, the cover in the app switcher). The page may name the
 * user's own program (as plain text, never a header); a notification never does. Screenshots are allowed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, HandHeart, ListChecks, Sprout, Waves, type LucideIcon } from 'lucide-react-native';
import {
  activePrograms,
  formatCountdown,
  momentProgram,
  recordWavePassed,
  strategyByKey,
  urgeProgress,
  urgeTextIndex,
} from '@thekra/practice-core';
import { QuoteCard } from '@/components/QuoteCard';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
import { FixItSheet } from '@/components/practice/sin/FixItSheet';
import { ProgressRing } from '@/components/practice/sin/ProgressRing';
import { useSinName } from '@/components/practice/sin/use-sin-name';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { MinimumWirdSheet } from '@/components/practice/mujahada/MinimumWirdSheet';
import { TasbihSheet } from '@/components/practice/mujahada/TasbihSheet';
import { useEvidence, useMomentEvidence, usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { pick, type MomentTool } from '@/lib/practice/catalog-types';
import { momentToolsFor } from '@/lib/practice/moment-tools';
import { mujahadaPassage } from '@/lib/practice/mujahada';
import { momentSource, today, usePracticeStore } from '@/lib/practice/practice-store';
import { programEntry } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import {
  BottomSheet,
  Button,
  ButtonPair,
  Chip,
  ForwardChevron,
  Icon,
  MIN_TARGET,
  NextStep,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  SectionHeader,
  Text,
  Wrap,
} from '@/ui';

const TICK_MS = 1000;

const makeStyles = (t: Theme) => ({
  center: { alignItems: 'center' as const, gap: space.xs },
  tools: { gap: space.sm },
  tool: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  toolPressed: { backgroundColor: t.colors.accent },
  toolTexts: { flex: 1, gap: 2 },
  /** The acts: one hairline list; the first row draws no top rule (A-05). */
  act: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: MIN_TARGET + 12,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  actLast: { borderBottomWidth: 0 },
  actDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: t.colors.primary },
  actText: { flex: 1, minWidth: 0 },
  verse: { gap: space.sm, alignItems: 'center' as const },
  chooser: { gap: space.sm },
});

type Outcome = { kind: 'held'; result: 'saved' | 'kept' | 'none' } | { kind: 'slipped' } | null;
type Tool = 'tasbih' | 'wird' | 'deeds';

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
      <Icon icon={icon} size={24} tone="link" strokeWidth={1.4} />
      <View style={styles.toolTexts}>
        <Text variant="body" weight="medium">
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
      <ForwardChevron size={18} tone="muted" />
    </Pressable>
  );
}

/** One act: its command, and «الدليل» on the row's end (A-07) naming the act for screen readers (A-19). */
function ActRow({ tool, last, onEvidence }: { tool: MomentTool; last: boolean; onEvidence: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const title = pick(tool, 'title', locale);
  return (
    <View style={[styles.act, last && styles.actLast]}>
      <View style={styles.actDot} />
      <Text variant="heading" style={styles.actText}>
        {title}
      </Text>
      <Button
        label={t('sinProgram.moment.evidence')}
        icon={BookOpen}
        variant="outline"
        size="sm"
        onPress={onEvidence}
        accessibilityLabel={t('sinProgram.moment.evidenceFor', { act: title })}
      />
    </View>
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
  const actEvidence = useMomentEvidence(catalog.data, locale);
  const { name: sinName } = useSinName();
  const mujahada = catalog.data?.mujahada;
  // Read once: the hand-off of the screen that opened this one (undefined: the header, the widget, a notification).
  const [source] = useState(momentSource);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [act, setAct] = useState<MomentTool | null>(null);
  /** The program picked in the chooser (several running, opened without a hand-off). */
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const d = today();
  const elapsed = (now - startedAt) / 1000;
  const running = useMemo(() => activePrograms(programs), [programs]);
  const fallback = useMemo(() => momentProgram(programs, source, d), [programs, source, d]);
  // No hand-off and several programs: the user says which one (the most recent working one is the default).
  const asksWhich = (source === undefined || source === null) && running.length > 1;
  const program = (asksWhich && picked ? running.find((p) => p.sinSlug === picked) : null) ?? fallback;
  // A sin page's hand-off without a program still gets that sin's acts (public content of the page it came from).
  const sinForActs = program?.sinSlug ?? (typeof source === 'string' ? source : null);
  const acts = momentToolsFor(catalog.data?.sinPrograms.moment, sinForActs);
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
  const wave = strategyByKey('ride-wave');

  function answerHeld() {
    if (!program) {
      setOutcome({ kind: 'held', result: 'none' });
      return;
    }
    const hadDay = program.checkIns.some((c) => c.date === d);
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (p.sinSlug === program.sinSlug && p.endedAt === undefined ? recordWavePassed(p, d) : p)) }));
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
    <Screen edges={['bottom']}>
      <PageHeader title={t('sinProgram.moment.title')} lead={t('sinProgram.moment.lead')} />

      <ProgressRing fraction={progress.fraction} label={t('sinProgram.moment.remaining', { time: formatCountdown(progress.remaining) })}>
        <View style={styles.center} importantForAccessibility="no-hide-descendants">
          <Text variant="display">{formatCountdown(progress.remaining)}</Text>
          <Text variant="caption" tone="muted" align="center">
            {t('sinProgram.moment.timer')}
          </Text>
        </View>
      </ProgressRing>

      {asksWhich ? (
        <View style={styles.chooser} accessibilityRole="radiogroup" accessibilityLabel={t('sinProgram.moment.which')}>
          <Text variant="small" weight="medium" tone="muted">
            {t('sinProgram.moment.which')}
          </Text>
          <Wrap>
            {running.map((p) => (
              <Chip key={p.sinSlug} label={sinName(p.sinSlug)} selected={program?.sinSlug === p.sinSlug} onPress={() => setPicked(p.sinSlug)} />
            ))}
          </Wrap>
        </View>
      ) : null}

      {acts.tools.length > 0 ? (
        <Section>
          <SectionHeader
            title={t('sinProgram.moment.actionsTitle')}
            // The program's name as plain text under the title, never a header (and only the user's own program).
            subtitle={acts.own && program && !asksWhich ? sinName(program.sinSlug) : undefined}
          />
          <View>
            {acts.tools.map((tool, i) => (
              <ActRow key={tool.key} tool={tool} last={i === acts.tools.length - 1} onEvidence={() => setAct(tool)} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t('sinProgram.moment.toolsTitle')}>
        <View style={styles.tools}>
          <ToolCard icon={HandHeart} title={t('mujahada.tools.tasbih')} hint={t('mujahada.tools.tasbihHint')} onPress={() => setTool('tasbih')} />
          <ToolCard icon={ListChecks} title={t('mujahada.tools.wird')} hint={t('mujahada.tools.wirdHint')} onPress={() => setTool('wird')} />
          <ToolCard icon={Sprout} title={t('mujahada.tools.deeds')} hint={t('mujahada.tools.deedsHint')} onPress={() => setTool('deeds')} />
        </View>
        {/* «اركب الموجة» in its moment (F-12 a): the strategy's idea, one line. */}
        {wave ? (
          <NextStep title={locale === 'en' ? wave.titleEn : wave.titleAr}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <View style={{ marginTop: 3 }}>
                <Icon icon={Waves} size={16} tone="link" />
              </View>
              <Text variant="small" style={{ flex: 1 }}>
                {t('practice.strategies.items.ride-wave.idea')}
              </Text>
            </View>
          </NextStep>
        ) : null}
      </Section>

      {verses.length > 0 ? (
        <>
          <SectionDivider />
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

      <SectionDivider />

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
          <ButtonPair
            size="lg"
            primary={{ label: t('sinProgram.moment.yes'), onPress: answerHeld }}
            secondary={{ label: t('sinProgram.moment.no'), onPress: answerSlipped }}
          />
        </Section>
      ) : (
        // Before the ten minutes end: the same question, its answers one tap away (never a lone, unexplained button),
        // and «ارجع إلى تخفَّف» beside it at the same size (A-06).
        <Section title={t('sinProgram.moment.question')}>
          <ButtonPair
            size="lg"
            primary={{ label: t('sinProgram.moment.answerEarly'), onPress: () => setEarly(true) }}
            secondary={program ? { label: t('sinProgram.moment.back'), onPress: () => router.replace('/practice/sin-program') } : null}
          />
        </Section>
      )}

      {program && (asking || outcome) ? (
        <Button label={t('sinProgram.moment.back')} onPress={() => router.replace('/practice/sin-program')} variant="outline" arrow />
      ) : null}

      <BottomSheet visible={act !== null} title={act ? pick(act, 'title', locale) : ''} onClose={() => setAct(null)}>
        {act ? (
          <>
            <EvidenceList
              ids={act.evidence}
              byId={actEvidence.data}
              loading={actEvidence.isLoading}
              error={actEvidence.isError}
              title={t('sinProgram.moment.evidence')}
              size="heading"
            />
            {/* Loaded, yet none of its texts came back (unpublished since, or offline with an old cache): say so. */}
            {!actEvidence.isLoading && !actEvidence.isError && !act.evidence.some((id) => actEvidence.data?.has(id)) ? (
              <Text variant="small" tone="muted">
                {t('sinProgram.moment.evidenceMissing')}
              </Text>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
      <BottomSheet visible={tool === 'deeds'} title={t('mujahada.tools.deeds')} onClose={() => setTool(null)}>
        <Text variant="small" tone="muted">
          {t('practice.strategies.deedsLead')}
        </Text>
        <EasyDeeds />
      </BottomSheet>
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
