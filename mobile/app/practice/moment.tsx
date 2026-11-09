/**
 * «لحظة مجاهدة» (owner round 6, C-01c / C-16: the reference's layout, our acts; the route keeps its name `moment`).
 * Which program it is about comes from the device only (practice-core `momentProgram`: a sin page's or «تخفَّف»'s
 * in-memory hand-off, never a route param); opened from the app header or the widget with several programs running,
 * a short chooser asks which one. The requests are the same for every user: the catalog, the evidence of every program
 * at once, and the public sins list for the names.
 *
 * Top to bottom:
 * - ONE prominent act first, in a quiet panel: the first of the acts tied to the Qur'an, the Sunnah or the salaf for
 *   this sin (catalog `sinPrograms.moment`), the other acts as chips under it (a tap makes one the prominent act); the
 *   generic acts when the sin has none of its own. No «الدليل» buttons here (C-16).
 * - Under a hairline in the same panel: a small outlined «ابدأ عشر دقائق» (C-16: small, under the act). The timer never
 *   starts by itself (C-01c); once started, the ring counts down.
 * - Two buttons: «نصوص تذكّرها» (this sin's texts, in a sheet) and «حلقة المعصية» (the program's loop, in a sheet).
 * - «أدوات تعينك» (the tasbih counter, «وردٌ أقصر», «أعمال سهلة») and «اركب الموجة» in its moment (F-12);
 *   one verse passage on patience, rotating; then «كيف كانت مجاهدتك؟». Healthy words only: a slip is a slip.
 *
 * Privacy: SinProgramGuard (the vault opened on the device, the cover in the app switcher). The page may name the
 * user's own program (as plain text, never a header); a notification never does. Screenshots are allowed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, HandHeart, ListChecks, Repeat, Sprout, Timer, Waves, type LucideIcon } from 'lucide-react-native';
import {
  activePrograms,
  addSinLoop,
  formatCountdown,
  isLightenCovered,
  momentProgram,
  recordWavePassed,
  removeSinLoop,
  strategyByKey,
  updateSinLoop,
  urgeProgress,
  urgeTextIndex,
  URGE_SECONDS,
  type SinProgram,
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
import { LoopsPanel } from '@/components/practice/loops/LoopsPanel';
import { useEvidence, usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { sinLoopInput, sinLoops } from '@/lib/practice/loops';
import { pick, type MomentTool } from '@/lib/practice/catalog-types';
import { momentToolsFor } from '@/lib/practice/moment-tools';
import { mujahadaPassage } from '@/lib/practice/mujahada';
import { momentSource, newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { programEntry } from '@/lib/practice/sin-program-view';
import { unlockWithDevice } from '@/lib/practice/use-sin-privacy';
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
  /** The reference's quiet panel: the one act first, then the timer under a hairline. */
  panel: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.panel,
    backgroundColor: t.colors.muted,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  rule: { height: 1, backgroundColor: t.colors.border, marginVertical: space.sm },
  timer: { alignItems: 'center' as const, gap: space.sm },
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

function MujahadaContent() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  // «تخفَّف» covered (round 6 C-02e, the default): the page names no program, and «حلقة المعصية» (the member's own
  // answers) opens only after the device lock, like every other place a program appears (web MujahadaView parity).
  const covered = usePracticeStore((s) => isLightenCovered(s.store));
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const { name: sinName } = useSinName();
  const mujahada = catalog.data?.mujahada;
  // Read once: the hand-off of the screen that opened this one (undefined: the header, the widget, a notification).
  const [source] = useState(momentSource);
  // The page opened at `openedAt`; the ten minutes start only on «ابدأ عشر دقائق» (C-01c).
  const [openedAt] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(openedAt);
  const [early, setEarly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  /** The act shown large (a chip's tap); the first act by default. */
  const [main, setMain] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'texts' | 'loop' | null>(null);
  /** The program picked in the chooser (several running, opened without a hand-off). */
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  const d = today();
  const elapsed = (now - (startedAt ?? openedAt)) / 1000;
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
  const progress = startedAt === null ? null : urgeProgress(startedAt, now);
  const asking = Boolean(progress?.done) || early;
  const shown = acts.tools.find((x) => x.key === main) ?? acts.tools[0];
  // «نصوص تذكّرها»: the program's texts for this sin (public quotes by id), else this sin's own page.
  const textIds = entry?.evidence ?? [];
  const loops = program ? sinLoops(program) : [];
  const editProgram = (change: (p: SinProgram) => SinProgram) =>
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (program && p.sinSlug === program.sinSlug && p.endedAt === undefined ? change(p) : p)) }));

  // «نصوص تذكّرها» and «حلقة المعصية», both outlined (the panel holds the one solid button).
  const textsAction = textIds.length > 0 || sinForActs ? { label: t('sinProgram.moment.texts'), icon: BookOpen, onPress: openTexts, variant: 'outline' as const } : null;
  const loopAction = program ? { label: t('loops.sin.title'), icon: Repeat, onPress: () => void openLoop(), variant: 'outline' as const } : null;
  const pairFirst = textsAction ?? loopAction;
  const pairSecond = textsAction ? loopAction : null;

  async function openLoop() {
    if (covered && !(await unlockWithDevice({ promptMessage: t('sinLock.prompt'), cancelLabel: t('common.cancel') }))) return;
    setSheet('loop');
  }

  function openTexts() {
    if (textIds.length > 0) setSheet('texts');
    else if (sinForActs) router.push(`/sins/${sinForActs}`);
  }
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
      <PageHeader title={t('sinProgram.moment.title')} />

      {asksWhich ? (
        <View style={styles.chooser} accessibilityRole="radiogroup" accessibilityLabel={t('sinProgram.moment.which')}>
          <Text variant="small" weight="medium" tone="muted">
            {t('sinProgram.moment.which')}
          </Text>
          <Wrap>
            {running.map((p) => (
              <Chip key={p.sinSlug} label={covered ? t('sinProgram.moment.programN', { n: running.indexOf(p) + 1 }) : sinName(p.sinSlug)} selected={program?.sinSlug === p.sinSlug} onPress={() => setPicked(p.sinSlug)} />
            ))}
          </Wrap>
        </View>
      ) : null}

      {/* ONE act first (C-16), the others as chips, then the optional timer under a hairline. */}
      <View style={styles.panel}>
        <Text variant="caption" tone="muted">
          {/* The program's name as plain text, never a header (and only the user's own program). */}
          {!covered && acts.own && program && !asksWhich ? `${t('sinProgram.moment.kicker')} · ${sinName(program.sinSlug)}` : t('sinProgram.moment.kicker')}
        </Text>
        {shown ? (
          <Text variant="display" accessibilityRole="text">
            {pick(shown, 'title', locale)}
          </Text>
        ) : null}
        {acts.tools.length > 1 ? (
          <>
            <Text variant="small" tone="muted">
              {t('sinProgram.moment.orOther')}
            </Text>
            <Wrap>
              {acts.tools
                .filter((x) => x.key !== shown?.key)
                .map((x) => (
                  <Chip key={x.key} label={pick(x, 'title', locale)} onPress={() => setMain(x.key)} />
                ))}
            </Wrap>
          </>
        ) : null}
        <View style={styles.rule} />
        {progress ? (
          <ProgressRing fraction={progress.fraction} label={t('sinProgram.moment.remaining', { time: formatCountdown(progress.remaining) })}>
            <View style={styles.center} importantForAccessibility="no-hide-descendants">
              <Text variant="display">{formatCountdown(progress.remaining)}</Text>
              <Text variant="caption" tone="muted" align="center">
                {t('sinProgram.moment.timer')}
              </Text>
            </View>
          </ProgressRing>
        ) : (
          // Idle: a small optional button under the act (C-16: «المؤقت زر صغير تحته»), never a big clock competing with it.
          <View style={styles.timer}>
            <Button
              label={t('sinProgram.moment.startTimer')}
              icon={Timer}
              variant="outline"
              size="sm"
              onPress={() => {
                const at = Date.now();
                setStartedAt(at);
                setNow(at);
              }}
            />
            <Text variant="caption" tone="muted" align="center">
              {t('sinProgram.moment.timerLead')}
            </Text>
          </View>
        )}
      </View>

      {pairFirst ? <ButtonPair primary={pairFirst} secondary={pairSecond} /> : null}

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

      <BottomSheet visible={sheet === 'texts'} title={t('sinProgram.moment.texts')} onClose={() => setSheet(null)}>
        <EvidenceList
          ids={textIds}
          byId={evidence.data}
          loading={evidence.isLoading}
          error={evidence.isError}
          title={t('sinProgram.textsTitle')}
          size="heading"
          moreHref={sinForActs ? `/sins/${sinForActs}` : undefined}
        />
      </BottomSheet>
      <BottomSheet visible={sheet === 'loop'} title={t('loops.sin.title')} onClose={() => setSheet(null)}>
        {program ? (
          <LoopsPanel
            kind="sin"
            single
            addLabel={t('sinProgram.loopTask.fill')}
            loops={loops}
            onAdd={(draft) => editProgram((p) => addSinLoop(p, newPracticeId(), sinLoopInput(draft)))}
            onUpdate={(id, draft) => editProgram((p) => updateSinLoop(p, id, sinLoopInput(draft)))}
            onRemove={(id) => editProgram((p) => removeSinLoop(p, id))}
          />
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
        remaining={progress?.remaining ?? URGE_SECONDS}
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
