/**
 * «ترك المعصية»: LOCAL ONLY (roadmap §0.1, §4). The chosen sin, the check-ins and the notes live in the
 * practice-core Store on this device and are never synced, sent, logged or shown in a notification.
 * The only network calls here are public and identical for every user: the catalog, the evidence of ALL
 * programs at once (useSinProgramEvidence) and the public sins list for names.
 * The sin's name is never a title: the native header and the page title stay generic («ترك المعصية», see
 * practice/_layout.tsx), and the name shows only as plain text inside the page, never as a header element.
 *
 * Flow: choose a catalog program → the willpower question (only when the program's `gradualAllowed` is true
 * and it is a sin against the right of Allah: owner decision D1) → practice-core `startProgram`. Then (redesign phase 3):
 * «لحظة ضعف» (practice/moment), yesterday's «حدّ صغير لغد», the no-reset counters («ثبتّ X من 30», «منذ آخر توبة»), the
 * stages as a compact line with only the current one open and its one task for the week, practical steps, alternatives,
 * the daily check-in (held / weak / fell_repented, optional trigger chips after a weak day or a fall, private note),
 * after «وقعت ثم تبت» the `afterFall` content with one hope text and the four-step «خربانة؟ صلّحها» sheet, «متى تضعف؟»
 * (derived here after 14 tagged check-ins), «دفتري الخاص» (past check-ins with their chips and notes, newest first)
 * and the texts once under «ما ورد فيها». Several programs run side by side, as on the website: each has its own
 * stage, check-in, notebook and «أنهِ هذا البرنامج» (confirmed); «ابدأ برنامجًا آخر», or a sin page's «ابدأ برنامج
 * الترك», opens the chooser with the sins not already followed.
 * «احذف كل بيانات البرنامج» wipes it all at once (no confirmation step: «خروج آمن», roadmap §4.2): local data, the
 * vault key, the server vault, and the private reminders (wipePrograms turns `sinReminders` off, so the lifecycle
 * cancels them).
 *
 * Privacy: SinProgramGuard holds the page behind the optional device lock («قفل برنامج الترك بالبصمة», Settings),
 * covers it whenever the app leaves the foreground and blocks screenshots while it is open.
 *
 * Layout after the website's leave-sin page: the title, the privacy line (ShieldCheck), the vault box, then the
 * chooser or the program (stage, steps, check-in, texts), the reminders, and the wipe section last.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { useLimits } from '@/lib/practice/use-habits-hub';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Plus, ShieldCheck, Waves } from 'lucide-react-native';
import {
  activePrograms,
  afterFall,
  annotateCheckIn,
  checkIn,
  currentStage,
  hasTriggers,
  hopeTextFor,
  limitForToday,
  programCounters,
  shortestTextId,
  STAGE_TASKS,
  stageTrack,
  startProgram,
  stagesFor,
  suggestedLimit,
  weakPattern,
  type CheckIn,
  type CheckInValue,
  type SinProgram,
  type Triggers,
} from '@thekra/practice-core';
import { usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { pick, pickList, type CatalogSinProgram, type StageContent } from '@/lib/practice/catalog-types';
import { shortDate } from '@/lib/practice/format';
import { ensurePermission } from '@/lib/practice/notifications';
import { pendingProgram, setMomentSource, setPendingProgram, today, usePracticeStore } from '@/lib/practice/practice-store';
import { notebookEntries, withProgramEnded, withProgramStarted } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useVaultState, wipeSinProgramEverywhere } from '@/lib/practice/vault-runner';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { QuoteDto } from '@/lib/types/api';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { TimeField } from '@/components/practice/editors';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
import { FixItSheet, useLimitLabel } from '@/components/practice/sin/FixItSheet';
import { TriggerChips } from '@/components/practice/sin/TriggerChips';
import { VaultCard, VaultSignInNote } from '@/components/practice/VaultCard';
import { radius, space, useStyles, type Theme } from '@/theme';
import {
  Button,
  CheckRow,
  ErrorState,
  Field,
  Icon,
  NextStep,
  Notice,
  PageHeader,
  Rule,
  Screen,
  Section,
  Skeleton,
  SwitchRow,
  Text,
} from '@/ui';

const CHECK_IN_KEYS: Record<CheckInValue, string> = {
  held: 'sinProgram.held',
  weak: 'sinProgram.weak',
  fell_repented: 'sinProgram.fell',
};
const CHECK_IN_VALUES: readonly CheckInValue[] = ['held', 'weak', 'fell_repented'];

const makeStyles = (t: Theme) => ({
  flex: { flex: 1 },
  block: { gap: space.md },
  tight: { gap: space.xs },
  options: { gap: space.sm },
  note: { minHeight: 96, textAlignVertical: 'top' as const },
  track: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, paddingVertical: space.xs },
  trackLine: { width: 12, height: 1, backgroundColor: t.colors.border },
  trackLineDone: { backgroundColor: t.colors.primary },
  stagePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  stagePillDone: { borderColor: t.colors.primary },
  stagePillCurrent: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
  counters: { gap: 2 },
  pattern: { gap: space.sm, padding: space.lg, borderRadius: radius.panel, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  bulletRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.md },
  bullet: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: t.colors.mutedForeground, marginTop: 12 },
  bulletText: { flex: 1 },
  altList: { borderTopWidth: 1, borderTopColor: t.colors.border },
  altRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  added: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  noteRow: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  end: { gap: space.md, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: t.colors.border },
  wipe: { gap: space.md, paddingTop: space['2xl'], borderTopWidth: 1, borderTopColor: t.colors.border },
});

/** The optional device lock and the app-switcher cover come first (SinProgramGuard). */
export default function SinProgramScreen() {
  return (
    <SinProgramGuard>
      <SinProgramContent />
    </SinProgramGuard>
  );
}

function SinProgramContent() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const allPrograms = usePracticeStore((s) => s.store.programs);
  const programs = useMemo(() => activePrograms(allPrograms), [allPrograms]);
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const sins = useSins({ limit: 100 });
  const hasProgramData = allPrograms.length > 0;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const vaultStatus = useVaultState((s) => s.status);
  // An end marker is kept only while an encrypted copy may exist (also while that is not known yet).
  const keepMarker = userId !== null && vaultStatus !== 'none';
  const [wiped, setWiped] = useState(false);
  const [ended, setEnded] = useState(false);
  // «ابدأ برنامج الترك» on a sin page hands its choice over in memory (never the route); read once, then cleared.
  const [pendingSin] = useState(pendingProgram);
  useEffect(() => setPendingProgram(null), []);
  /** Null until the user opens or closes the chooser: a sin page's hand-off opens it beside the current program. */
  const [choosing, setChoosing] = useState<boolean | null>(null);
  // One «تخفَّف» program until it reaches its last stage (practice-core `limits`).
  const planLimits = useLimits();

  if (!hydrated || catalog.isLoading || sins.isLoading) return <ProgramSkeleton />;
  if (catalog.isError || !catalog.data) {
    return (
      <Screen edges={['bottom']}>
        <PageHeader eyebrow={t('record.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
        <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />
      </Screen>
    );
  }

  const sinName = (slug: string) => {
    const s = sins.data?.find((x) => x.slug === slug);
    // Never the raw slug: an unknown sin reads as «برنامجك».
    if (!s) return t('sinProgram.unnamed');
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  };

  const entries = catalog.data.sinPrograms.programs;
  const following = new Set(programs.map((p) => p.sinSlug));
  const preselected = pendingSin && !following.has(pendingSin) && entries.some((p) => p.sin === pendingSin) ? pendingSin : null;
  const canStart = programs.length === 0 || planLimits.canAdd('program');
  const showChooser = programs.length === 0 || (canStart && (choosing ?? preselected !== null));
  const canAddAnother = entries.some((p) => !following.has(p.sin));

  function handleStarted() {
    setChoosing(false);
    setEnded(false);
    setWiped(false);
  }

  function handleEnded() {
    setChoosing(null);
    setEnded(true);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen edges={['bottom']} decor>
        <PageHeader eyebrow={t('record.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
        <Notice icon={ShieldCheck}>{t('sinProgram.privacy')}</Notice>
        {wiped && programs.length === 0 ? <Notice icon={Check}>{t('sinProgram.wiped')}</Notice> : null}
        {ended ? <Notice icon={Check}>{t('sinProgram.end.done')}</Notice> : null}
        {userId ? <VaultCard userId={userId} hasProgram={programs.length > 0} /> : <VaultSignInNote />}
        {showChooser ? (
          <ChooseProgram
            programs={entries.filter((p) => !following.has(p.sin))}
            sinName={sinName}
            preselected={preselected}
            onStarted={handleStarted}
            onCancel={programs.length > 0 ? () => setChoosing(false) : undefined}
          />
        ) : null}
        {programs.length > 0 && !showChooser ? (
          <>
            <Button
              label={t('sinProgram.moment.open')}
              icon={Waves}
              variant="outline"
              onPress={() => {
                setMomentSource(null);
                router.push('/practice/moment');
              }}
            />
            {programs.map((program, index) => (
              <View key={program.sinSlug} style={styles.block}>
                {index > 0 ? <Rule /> : null}
                <ProgramView
                  program={program}
                  entry={entries.find((p) => p.sin === program.sinSlug)}
                  sinName={sinName(program.sinSlug)}
                  evidenceById={evidence.data}
                  evidenceLoading={evidence.isLoading}
                  evidenceError={evidence.isError}
                />
                <EndProgram sinSlug={program.sinSlug} keepMarker={keepMarker} onEnded={handleEnded} />
              </View>
            ))}
            {canAddAnother ? (
              <Button label={t('sinProgram.another')} icon={Plus} onPress={() => setChoosing(true)} variant="outline" />
            ) : null}
            <SinReminders />
          </>
        ) : null}
        <LimitSheet
          kind="program"
          visible={choosing === true && !canStart}
          limits={planLimits}
          onClose={() => setChoosing(false)}
          onFreed={() => setChoosing(false)}
        />
        {hasProgramData ? <WipeSection userId={userId} onWiped={() => setWiped(true)} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** The page's shape while the store, the catalog and the names load. */
function ProgramSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']}>
      <PageHeader eyebrow={t('record.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
      <View style={styles.block} accessibilityLabel={t('common.loading')}>
        <Skeleton height={16} />
        <Skeleton width="80%" height={16} />
      </View>
      <View style={styles.options}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    </Screen>
  );
}

interface ChooseProgramProps {
  programs: CatalogSinProgram[];
  sinName: (slug: string) => string;
  /** The sin a sin page handed over, if any. */
  preselected: string | null;
  onStarted: () => void;
  /** Back to the programs being followed (only when there are some). */
  onCancel?: () => void;
}

/** The catalog programs not already followed; starting one runs it beside the others. */
function ChooseProgram({ programs, sinName, preselected, onStarted, onCancel }: ChooseProgramProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const setStore = usePracticeStore((s) => s.setStore);
  const [selected, setSelected] = useState<CatalogSinProgram | null>(() => programs.find((p) => p.sin === preselected) ?? null);
  const [hard, setHard] = useState<boolean | null>(null);

  const common = catalog.data?.sinPrograms.common;
  // Owner decision D1: the gradual path is offered only where the catalog allows it (haqq_allah programs).
  const asksWill = Boolean(selected?.gradualAllowed && selected.category === 'haqq_allah');

  function handleStart() {
    if (!selected) return;
    const program = startProgram({
      sinSlug: selected.sin,
      category: selected.category,
      hardToLeaveAtOnce: asksWill && hard === true,
      startedOn: today(),
    });
    setStore((s) => ({ ...s, programs: withProgramStarted(s.programs, program) }));
    onStarted();
  }

  return (
    <Section title={t('sinProgram.choose')}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {programs.map((p) => (
          <CheckRow
            key={p.sin}
            radio
            title={sinName(p.sin)}
            hint={p.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')}
            checked={selected?.sin === p.sin}
            onPress={() => {
              setSelected(p);
              setHard(null);
            }}
          />
        ))}
      </View>
      {selected && asksWill && common ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          <Text variant="heading">{pick(common, 'willQuestion', locale)}</Text>
          <CheckRow radio title={t('sinProgram.yesHard')} checked={hard === true} onPress={() => setHard(true)} />
          <CheckRow radio title={t('sinProgram.noCanLeave')} checked={hard === false} onPress={() => setHard(false)} />
        </View>
      ) : null}
      {selected ? <Button label={t('sinProgram.start')} onPress={handleStart} disabled={asksWill && hard === null} arrow large /> : null}
      {onCancel ? <Button label={t('common.cancel')} onPress={onCancel} variant="outline" /> : null}
    </Section>
  );
}

interface SubSectionProps {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'link';
}

/** A titled part of the program (the website's h3). */
function SubSection({ title, children, tone }: SubSectionProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.block}>
      <Text variant="heading" tone={tone} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function StageBody({ content }: { content: StageContent }) {
  const locale = useUiLocale();
  return <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(content, 'body', locale)}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tight}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text variant="body" style={styles.bulletText}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface ProgramViewProps {
  program: SinProgram;
  entry: CatalogSinProgram | undefined;
  sinName: string;
  evidenceById: Map<string, QuoteDto> | undefined;
  evidenceLoading: boolean;
  evidenceError: boolean;
}

function ProgramView({ program, entry, sinName, evidenceById, evidenceLoading, evidenceError }: ProgramViewProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const common = catalog.data?.sinPrograms.common;
  const [fixOpen, setFixOpen] = useState(false);
  const d = today();
  const stage = currentStage(program, d);
  const stageKeys = stagesFor(program.category);
  const track = stageTrack(program, d);
  const stageContent = common?.stages[stage.stage];
  const todayCheckIn = program.checkIns.find((c) => c.date === d);
  const showAfterFall = todayCheckIn?.value === 'fell_repented' && afterFall(program) === 'fixit';
  const actions = entry ? pickList(entry.actionsAr, entry.actionsEn, locale) : [];
  const limitLabel = useLimitLabel(actions);
  const todayLimit = limitForToday(program, d);
  const todayLimitText = todayLimit ? limitLabel(todayLimit) : null;
  const counters = programCounters(program, d);
  const gradual = entry && program.path === 'gradual' ? pickList(entry.gradualStepsAr, entry.gradualStepsEn, locale) : [];
  const evidenceProps = { byId: evidenceById, loading: evidenceLoading, error: evidenceError };
  const afterFallIds = common?.afterFall.evidence ?? [];
  const texts = evidenceById ? [...evidenceById.values()] : [];
  const hopeId = showAfterFall ? hopeTextFor(afterFallIds, texts, d, shortestTextId(afterFallIds, texts)) : null;
  // «ما ورد فيها»: the program's texts and the current stage's, each once.
  const textIds = [...new Set([...(entry?.evidence ?? []), ...(stageContent?.evidence ?? [])])];

  return (
    <>
      {/* The name is page content only: no header role, so it never lands in a title or the headings list. */}
      <View style={styles.tight}>
        <Text variant="title">{sinName}</Text>
        <Text variant="small" tone="muted">
          {`${program.path === 'gradual' ? t('sinProgram.pathGradual') : t('sinProgram.pathCut')} · ${
            program.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')
          }`}
        </Text>
      </View>

      {todayLimitText ? (
        <NextStep>
          <Text variant="body">{t('sinProgram.limits.today', { limit: todayLimitText })}</Text>
        </NextStep>
      ) : null}

      <View style={styles.counters}>
        <Text variant="heading">
          {`${t('sinProgram.counters.held', { n: String(counters.held), total: String(counters.window) })} · ${t(
            counters.fromStart ? 'sinProgram.counters.sinceStart' : 'sinProgram.counters.sinceRepentance',
            { count: counters.daysSinceRepentance },
          )}`}
        </Text>
        <Text variant="small" tone="muted">
          {t('sinProgram.counters.note')}
        </Text>
      </View>

      {gradual.length > 0 ? (
        <NextStep title={t('sinProgram.gradualSteps')}>
          {gradual.map((step, i) => (
            <Text key={step} variant="small">{`${i + 1}. ${step}`}</Text>
          ))}
        </NextStep>
      ) : null}

      {stageContent && common ? (
        <View style={styles.block}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t('sinProgram.stages.track')}>
            <View style={styles.track}>
              {track.map(({ stage: key, state }, index) => {
                const content = common.stages[key];
                if (!content) return null;
                return (
                  <React.Fragment key={key}>
                    {index > 0 ? <View style={[styles.trackLine, state !== 'next' && styles.trackLineDone]} /> : null}
                    <View
                      style={[styles.stagePill, state === 'done' && styles.stagePillDone, state === 'current' && styles.stagePillCurrent]}
                      accessible
                      accessibilityLabel={`${t(`sinProgram.stages.${state}`)}: ${pick(content, 'title', locale)}`}
                      accessibilityState={{ selected: state === 'current' }}
                    >
                      {state === 'done' ? <Icon icon={Check} size={12} tone="link" /> : null}
                      <Text variant="caption" tone={state === 'current' ? 'inverse' : state === 'done' ? 'link' : 'muted'}>
                        {pick(content, 'title', locale)}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
          <Text variant="eyebrow">
            {`${t('sinProgram.stage', { n: String(stage.index + 1), total: String(stageKeys.length) })} · ${t('sinProgram.since', {
              date: shortDate(stage.since),
            })}`}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {pick(stageContent, 'title', locale)}
          </Text>
          <StageBody content={stageContent} />
          <NextStep title={t('sinProgram.stages.taskTitle')}>
            <Text variant="body">{t(`sinProgram.stages.tasks.${STAGE_TASKS[stage.stage]}`)}</Text>
          </NextStep>
          <Text variant="small" tone="muted">
            {t('sinProgram.stageHint')}
          </Text>
        </View>
      ) : null}

      {actions.length > 0 ? (
        <SubSection title={t('sinProgram.actions')}>
          <BulletList items={actions} />
        </SubSection>
      ) : null}

      {entry?.alternatives && entry.alternatives.length > 0 ? <Alternatives keys={entry.alternatives} /> : null}

      {entry?.help && common ? <NextStep title={t('sinProgram.help')}>{pick(common, 'help', locale)}</NextStep> : null}

      <CheckInForm program={program} onFell={() => setFixOpen(true)} />

      {showAfterFall && common ? (
        <SubSection title={pick(common.afterFall, 'title', locale)} tone="link">
          <StageBody content={common.afterFall} />
          {hopeId ? <EvidenceList ids={[hopeId]} {...evidenceProps} title={t('sinProgram.counters.hope')} /> : null}
          <Button label={t('sinProgram.fixit.open')} onPress={() => setFixOpen(true)} />
        </SubSection>
      ) : null}
      {entry && common ? (
        <FixItSheet
          visible={fixOpen}
          onClose={() => setFixOpen(false)}
          program={program}
          entry={entry}
          common={common}
          habits={catalog.data?.habits ?? []}
          evidenceById={evidenceById}
          today={d}
        />
      ) : null}

      <WeakPatternCard program={program} actions={actions} />

      <Notebook program={program} />

      <EvidenceList ids={textIds} {...evidenceProps} title={t('sinProgram.textsTitle')} />
    </>
  );
}

/** «متى تضعف؟»: derived on this device from the trigger chips; shown after 14 tagged check-ins, never sent. */
function WeakPatternCard({ program, actions }: { program: SinProgram; actions: readonly string[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const limitLabel = useLimitLabel(actions);
  const pattern = weakPattern(program);
  if (!pattern) return null;
  const limit = limitLabel(suggestedLimit(pattern, actions.length));
  return (
    <View style={styles.pattern}>
      <Text variant="heading" accessibilityRole="header">
        {t('sinProgram.pattern.title')}
      </Text>
      <Text variant="small" tone="muted">
        {t('sinProgram.pattern.lead')}
      </Text>
      {pattern.when ? <Text variant="body">{t('sinProgram.pattern.when', { value: t(`sinProgram.triggers.times.${pattern.when}`) })}</Text> : null}
      {pattern.where ? <Text variant="body">{t('sinProgram.pattern.where', { value: t(`sinProgram.triggers.places.${pattern.where}`) })}</Text> : null}
      {pattern.feeling ? (
        <Text variant="body">{t('sinProgram.pattern.feeling', { value: t(`sinProgram.triggers.feelings.${pattern.feeling}`) })}</Text>
      ) : null}
      {limit ? <Text variant="label">{t('sinProgram.pattern.suggestion', { limit })}</Text> : null}
    </View>
  );
}

/** Good habits in its place: each opens «أضف عادة» prefilled, or shows that it is already a habit. */
function Alternatives({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = catalog.data?.habits ?? [];
  const planIds = new Set(plans.map((p) => p.habitKey ?? p.id));
  return (
    <SubSection title={t('sinProgram.alternatives')}>
      <View style={styles.altList}>
        {keys.map((key) => {
          const h = habits.find((x) => x.key === key);
          if (!h) return null;
          return (
            <View key={key} style={styles.altRow}>
              <Text variant="body" style={styles.bulletText}>
                {pick(h, 'title', locale)}
              </Text>
              {planIds.has(key) ? (
                <View style={styles.added}>
                  <Icon icon={Check} size={16} tone="link" />
                  <Text variant="small" tone="muted">
                    {t('sinProgram.added')}
                  </Text>
                </View>
              ) : (
                <Button
                  label={t('sinProgram.addAlternative')}
                  icon={Plus}
                  onPress={() => router.push({ pathname: '/practice/add', params: { habit: key } })}
                  variant="outline"
                />
              )}
            </View>
          );
        })}
      </View>
    </SubSection>
  );
}

/** «كيف كان يومك؟»: one of three, optional trigger chips after «ضعفت» / «وقعت ثم تبت», an optional private note. */
function CheckInForm({ program, onFell }: { program: SinProgram; onFell: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const [value, setValue] = useState<CheckInValue | null>(null);
  const [triggers, setTriggers] = useState<Triggers | null>(null);
  const [note, setNote] = useState('');
  const d = today();
  const todayCheckIn = program.checkIns.find((c) => c.date === d);
  const shownTriggers = triggers ?? todayCheckIn?.triggers ?? {};

  function save() {
    if (!value) return;
    const trimmed = note.trim();
    setStore((s) => ({
      ...s,
      programs: s.programs.map((p) => {
        if (p.sinSlug !== program.sinSlug) return p;
        const saved = checkIn(p, d, value, trimmed || undefined);
        return value === 'held' ? saved : annotateCheckIn(saved, d, { triggers: shownTriggers });
      }),
    }));
    setNote('');
    setTriggers(null);
    if (value === 'fell_repented' && todayCheckIn?.value !== 'fell_repented') onFell();
  }

  return (
    <SubSection title={t('sinProgram.checkInTitle')}>
      {todayCheckIn ? (
        <Text variant="small" tone="muted">
          {t('sinProgram.todayValue', { value: t(CHECK_IN_KEYS[todayCheckIn.value]) })}
        </Text>
      ) : null}
      <View style={styles.options} accessibilityRole="radiogroup">
        {CHECK_IN_VALUES.map((v) => (
          <CheckRow key={v} radio title={t(CHECK_IN_KEYS[v])} checked={value === v} onPress={() => setValue(v)} />
        ))}
      </View>
      {value === 'weak' || value === 'fell_repented' ? <TriggerChips value={shownTriggers} onChange={setTriggers} /> : null}
      <Field
        label={t('sinProgram.note')}
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.note}
        autoComplete="off"
        importantForAutofill="no"
      />
      <Button label={t('sinProgram.saveCheckIn')} onPress={save} disabled={!value} />
    </SubSection>
  );
}

function triggerLine(c: CheckIn, t: (key: string) => string): string | null {
  if (!hasTriggers(c.triggers)) return null;
  const parts = [
    c.triggers.when ? t(`sinProgram.triggers.times.${c.triggers.when}`) : null,
    c.triggers.where ? t(`sinProgram.triggers.places.${c.triggers.where}`) : null,
    c.triggers.feeling ? t(`sinProgram.triggers.feelings.${c.triggers.feeling}`) : null,
  ].filter((x): x is string => x !== null);
  return parts.join('، ');
}

/** «دفتري الخاص»: past check-ins with their notes, newest first. Shown here only; the name of the sin is not in it. */
function Notebook({ program }: { program: SinProgram }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const entries = notebookEntries(program, today());
  if (entries.length === 0) return null;
  return (
    <SubSection title={t('sinProgram.notebook')}>
      <View style={styles.altList}>
        {entries.map((c) => (
          <View key={c.date} style={styles.noteRow}>
            <Text variant="small" tone="muted">
              {[shortDate(c.date), t(CHECK_IN_KEYS[c.value]), triggerLine(c, t)].filter(Boolean).join(' · ')}
            </Text>
            {c.note ? <Text variant="body">{c.note}</Text> : null}
          </View>
        ))}
      </View>
    </SubSection>
  );
}

interface EndProgramProps {
  sinSlug: string;
  keepMarker: boolean;
  onEnded: () => void;
}

/** «أنهِ هذا البرنامج»: closes the program after a confirmation; its check-ins and notes are removed. */
function EndProgram({ sinSlug, keepMarker, onEnded }: EndProgramProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);

  function commitEnd() {
    setStore((s) => ({ ...s, programs: withProgramEnded(s.programs, sinSlug, keepMarker) }));
    onEnded();
  }

  function handleEnd() {
    Alert.alert(t('sinProgram.end.confirmTitle'), t('sinProgram.end.confirmBody'), [
      { text: t('sinProgram.end.cancel'), style: 'cancel' },
      { text: t('sinProgram.end.confirm'), style: 'destructive', onPress: commitEnd },
    ]);
  }

  return (
    <View style={styles.end}>
      <Text variant="small" tone="muted">
        {t('sinProgram.end.lead')}
      </Text>
      <Button label={t('sinProgram.end.button')} onPress={handleEnd} variant="outline" />
    </View>
  );
}

/** The private daily reminder: its text never names the program (see `sinProgram.remindersHint`). */
function SinReminders() {
  const { t } = useTranslation();
  const prefs = usePracticeStore((s) => s.prefs);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [denied, setDenied] = useState(false);

  async function toggleReminders(on: boolean) {
    setDenied(false);
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      setDenied(true);
      return;
    }
    setPrefs((p) => ({ ...p, sinReminders: on }));
  }

  return (
    <Section title={t('practice.reminders')}>
      <SwitchRow
        label={t('sinProgram.reminders')}
        hint={t('sinProgram.remindersHint')}
        value={prefs.sinReminders}
        onValueChange={(v) => void toggleReminders(v)}
      />
      {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
      {prefs.sinReminders ? (
        <>
          <Rule />
          <TimeField label={t('sinProgram.time')} value={prefs.sinReminderTime} onChange={(time) => setPrefs((p) => ({ ...p, sinReminderTime: time }))} />
        </>
      ) : null}
    </Section>
  );
}

interface WipeSectionProps {
  userId: string | null;
  onWiped: () => void;
}

/** «خروج آمن»: one tap erases everything at once (roadmap §4.2), no confirmation step in between. */
function WipeSection({ userId, onWiped }: WipeSectionProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);

  function wipe() {
    // The local store empties at once (this section unmounts with the program); the parent says it is done.
    onWiped();
    // Local programs and notes, the vault key (memory + keystore) and, signed in, the vault on the server.
    void wipeSinProgramEverywhere(userId);
  }

  return (
    <View style={styles.wipe}>
      <Text variant="heading" accessibilityRole="header">
        {t('sinProgram.wipe')}
      </Text>
      <Text variant="small" tone="muted">
        {t('sinProgram.wipeHint')}
      </Text>
      <Button label={t('sinProgram.wipe')} onPress={wipe} variant="destructive" />
    </View>
  );
}
