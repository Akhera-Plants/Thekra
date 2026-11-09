/**
 * «تخفَّف»: leaving a sin, step by step. Always kept encrypted in the account (owner decision 2026-11-01,
 * docs/plan/2026-11-01-sin-vault-always-on.md): the chosen sin, the check-ins, the notes and «حلقة المعصية» live in the
 * practice-core Store on this device and reach the network only sealed in the sin vault (vault-runner.ts autosaves every
 * change). The first program asks for a «رمز الخصوصية» once; then the fingerprint / face opens this page
 * (SinProgramGuard). The other network calls are public and identical for every user: the catalog, the evidence of ALL
 * programs at once (useSinProgramEvidence) and the public sins list for names.
 * The sin's name is never a header element: the native header and the page title stay generic (practice/_layout.tsx);
 * the name shows inside the page as plain text (the program switch), never with a header role.
 *
 * Flow (every sin can start «تخفَّف»): choose any sin of the public list (searchable; those with a written program
 * first) → for a sin without a written program, «هل فيها حقٌّ لأحد من الناس؟» → for a written program, the willpower
 * question (only when `gradualAllowed` and a sin against the right of Allah: owner decision D1) → the privacy code when
 * the account has no vault yet → practice-core `startProgram`. Limits (owner round 3, item 16): up to 3 programs, and a
 * new one only when every running one has lasted two months (the limit sheet says why and when).
 *
 * A running program (owner round 5, F-11 a / A-21 a): the program's name is a selectable title (a sheet switches
 * between the running programs and starts another), then ONE tab bar:
 * - «اليوم»: the day's limit, ONE counter line, «لحظة مجاهدة», the evening check-in with its optional note (that note is
 *   the notebook), and after a slip the gentle after-fall content and «صلّحها»;
 * - «رحلتي»: the stages with this week's task («حلقة المعصية» is the first week's task, filled once), the «متى تضعف؟»
 *   summary, the texts under «اعرف ضررها» («آيات وأحاديث تعينك على ترك هذه المعصية», O-05 / A-03), practical steps,
 *   good habits in its place, help, and the notebook's past days (folded).
 * Round 6 (C-15): no privacy line on the page; «أقفل» on the title line locks it again. «أنهِ هذا البرنامج» lives in the header's «⋯» menu
 * (A-15), confirmed there; it removes check-ins, notes and loops. Reminders are set in «التنبيهات» only (A-20).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { useLimits, useShortDate } from '@/lib/practice/use-habits-hub';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronUp, LockKeyhole, Plus, ShieldCheck, Trash2, Waves } from 'lucide-react-native';
import {
  activePrograms,
  addSinLoop,
  afterFall,
  annotateCheckIn,
  checkIn,
  currentStage,
  hasTriggers,
  hopeTextFor,
  limitForToday,
  programCounters,
  removeSinLoop,
  shortestTextId,
  STAGE_TASKS,
  stageTrack,
  startProgram,
  stagesFor,
  suggestedLimit,
  updateSinLoop,
  weakPattern,
  type CheckIn,
  type CheckInValue,
  type SinProgram,
  type Triggers,
} from '@thekra/practice-core';
import { StoryLine } from '@/components/practice/hub/KnowledgeCards';
import { usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { pick, pickList, type CatalogSinProgram, type StageContent } from '@/lib/practice/catalog-types';
import { pendingProgram, setMomentSource, setPendingProgram, today, usePracticeStore } from '@/lib/practice/practice-store';
import {
  categoryFromAnswer,
  notebookEntries,
  programEntry,
  sinChoices,
  withProgramEnded,
  withProgramStarted,
} from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { createVaultWithCode, useVaultState } from '@/lib/practice/vault-runner';
import { sinLoopInput, sinLoops } from '@/lib/practice/loops';
import { newPracticeId } from '@/lib/practice/practice-store';
import { PrivacyCodeForm } from '@/components/practice/VaultCard';
import { LoopsPanel } from '@/components/practice/loops/LoopsPanel';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { QuoteDto } from '@/lib/types/api';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { SinProgramGuard, useLockProgram } from '@/components/practice/SinProgramGuard';
import { FixItSheet, useLimitLabel } from '@/components/practice/sin/FixItSheet';
import { TriggerChips } from '@/components/practice/sin/TriggerChips';
import { useSinName } from '@/components/practice/sin/use-sin-name';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import {
  ActionMenu,
  BottomSheet,
  Button,
  ButtonPair,
  CheckRow,
  ErrorState,
  Field,
  Icon,
  MIN_TARGET,
  NextStep,
  Notice,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  type SegmentItem,
  SegmentTabs,
  Skeleton,
  Text,
  TextLink,
  toast,
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
  pattern: { gap: space.sm, padding: space.lg, borderRadius: radius.panel, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  bulletRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.md },
  bullet: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: t.colors.mutedForeground, marginTop: 12 },
  bulletText: { flex: 1 },
  /** No top rule: the list sits right under its title (A-05: no double lines). */
  altList: {},
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
  /** The program's name as the selectable title: the name, its chevron, the path line under it. */
  switcher: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: MIN_TARGET, alignSelf: 'flex-start' as const, maxWidth: '100%' as const },
  switcherName: { flexShrink: 1 },
  privacy: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: MIN_TARGET, alignSelf: 'flex-start' as const },
  fold: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 56, paddingVertical: space.sm },
  foldTitle: { flex: 1, minWidth: 0 },
  taskDone: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
});

/** The vault opened on the device and the app-switcher cover come first (SinProgramGuard). */
export default function SinProgramScreen() {
  return (
    <SinProgramGuard requireAccount>
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
  const sins = useSinName();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const vaultStatus = useVaultState((s) => s.status);
  // An end marker is kept only while an encrypted copy may exist (also while that is not known yet).
  const keepMarker = userId !== null && vaultStatus !== 'none';
  const [ended, setEnded] = useState(false);
  // «تخفّف من هذه المعصية» / «مقفل ✓» on a sin page hands its sin over in memory (never the route); read once, then cleared.
  const [pendingSin] = useState(pendingProgram);
  useEffect(() => setPendingProgram(null), []);
  const lock = useLockProgram();
  /** Null until the user opens or closes the chooser: a sin page's hand-off opens it beside the current program. */
  const [choosing, setChoosing] = useState<boolean | null>(null);
  /** The program shown when several run (chosen from the title's sheet; a sin page's hand-off shows its own). */
  const [focus, setFocus] = useState<string | null>(pendingSin);
  const [switching, setSwitching] = useState(false);
  // Up to 3 programs, each running one at least two months old before another starts (practice-core `limits`).
  const planLimits = useLimits();
  const setStore = usePracticeStore((s) => s.setStore);

  if (!hydrated || catalog.isLoading || sins.isLoading) return <ProgramSkeleton />;
  if (catalog.isError || !catalog.data) {
    return (
      <Screen edges={['bottom']}>
        <PageHeader title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
        <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />
      </Screen>
    );
  }

  const sinName = sins.name;
  const entries = catalog.data.sinPrograms.programs;
  const following = new Set(programs.map((p) => p.sinSlug));
  const allSins = sins.list;
  const preselected = pendingSin && !following.has(pendingSin) ? pendingSin : null;
  const canStart = programs.length === 0 || planLimits.canAdd('program');
  const showChooser = programs.length === 0 || (canStart && (choosing ?? preselected !== null));
  const canAddAnother = allSins.some((x) => !following.has(x.slug));
  const current = programs.find((p) => p.sinSlug === focus) ?? programs[0];
  // Programs kept from an older build, before «تخفَّف» was always saved: protect them with a code once.
  const needsProtect = userId !== null && vaultStatus === 'none' && programs.length > 0;
  // Saved in the account: the privacy line folds to one row (A-21 a).
  const saved = vaultStatus !== 'none' && programs.length > 0;

  function handleStarted(slug: string) {
    setChoosing(false);
    setEnded(false);
    setFocus(slug);
  }

  function endProgram(slug: string) {
    setStore((s) => ({ ...s, programs: withProgramEnded(s.programs, slug, keepMarker) }));
    setChoosing(null);
    setEnded(true);
    toast(t('sinProgram.end.toast'));
  }

  async function protect(code: string): Promise<string | null> {
    if (!userId) return 'failed';
    const err = await createVaultWithCode(userId, code, programs);
    if (!err) toast(t('vault.savedToast'));
    return err;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <Screen edges={['bottom']}>
        {/* Page actions behind «⋯» (A-15): ending a program is red and confirmed there, never a button on the page. */}
        <Stack.Screen
          options={{
            headerRight:
              programs.length > 0 && !showChooser && current
                ? () => (
                    <ActionMenu
                      items={[
                        {
                          label: t('sinProgram.end.button'),
                          icon: Trash2,
                          destructive: true,
                          onPress: () => endProgram(current.sinSlug),
                          confirm: {
                            title: t('sinProgram.end.confirmTitle'),
                            message: t('sinProgram.end.confirmBody'),
                            confirmLabel: t('sinProgram.end.confirm'),
                          },
                        },
                      ]}
                    />
                  )
                : () => null,
          }}
        />
        {/* Round 6 (C-15): no «محفوظ مشفّرًا في حسابك» line; the lock button «أقفل» on the title line closes the page
            at once (the locked state reads «مقفل ✓», and a tap asks the device lock or the code again). */}
        <PageHeader title={t('sinProgram.title')} lead={t('sinProgram.lead')} action={saved && lock ? <Button label={t('sinLock.lock')} icon={LockKeyhole} variant="outline" size="sm" onPress={lock} /> : undefined} />
        {ended ? <Notice icon={Check}>{t('sinProgram.end.done')}</Notice> : null}
        {showChooser ? (
          <ChooseProgram
            sins={allSins}
            entries={entries}
            following={following}
            preselected={preselected}
            onStarted={handleStarted}
            onCancel={programs.length > 0 ? () => setChoosing(false) : undefined}
          />
        ) : null}
        {needsProtect && userId ? <ProtectPrograms onSubmit={protect} /> : null}
        {programs.length > 0 && !showChooser && current ? (
          <>
            <ProgramView
              key={current.sinSlug}
              program={current}
              entry={programEntry(entries, current.sinSlug, current.category)}
              sinName={sinName(current.sinSlug)}
              onSwitch={() => setSwitching(true)}
              evidenceById={evidence.data}
              evidenceLoading={evidence.isLoading}
              evidenceError={evidence.isError}
            />
            <BottomSheet visible={switching} title={t('sinProgram.switchTitle')} onClose={() => setSwitching(false)}>
              <View style={styles.options} accessibilityRole="radiogroup">
                {programs.map((p) => (
                  <CheckRow
                    key={p.sinSlug}
                    radio
                    title={sinName(p.sinSlug)}
                    hint={p.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')}
                    checked={p.sinSlug === current.sinSlug}
                    onPress={() => {
                      setFocus(p.sinSlug);
                      setSwitching(false);
                    }}
                  />
                ))}
              </View>
              {canAddAnother ? (
                <Button
                  label={t('sinProgram.another')}
                  icon={Plus}
                  variant="outline"
                  onPress={() => {
                    setSwitching(false);
                    setChoosing(true);
                  }}
                />
              ) : null}
            </BottomSheet>
          </>
        ) : null}
        <LimitSheet
          kind="program"
          visible={choosing === true && !canStart}
          limits={planLimits}
          onClose={() => setChoosing(false)}
          onFreed={() => setChoosing(false)}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

/**
 * Programs kept from an older build, not saved in the account yet: one folded line (A-21 a: the code card no longer sits
 * open above the program); «احفظها مشفّرة» opens the code form, which is gone once saved.
 */
function ProtectPrograms({ onSubmit }: { onSubmit: (code: string) => Promise<string | null> }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  if (open) return <PrivacyCodeForm submitLabel={t('vault.protect')} onSubmit={onSubmit} onCancel={() => setOpen(false)} />;
  return (
    <NextStep>
      <View style={styles.tight}>
        <Text variant="body">{t('sinProgram.protect.line')}</Text>
        <Button label={t('sinProgram.protect.open')} icon={ShieldCheck} variant="outline" size="sm" onPress={() => setOpen(true)} />
      </View>
    </NextStep>
  );
}

/** A folded part of «رحلتي» (the notebook's past days, the loop in later weeks): title, count, chevron. */
function Fold({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.fold, pressed && { opacity: 0.7 }]}
      >
        <Text variant="heading" style={styles.foldTitle}>
          {title}
        </Text>
        {count !== undefined ? (
          <Text variant="small" tone="muted">
            {String(count)}
          </Text>
        ) : null}
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} tone="muted" />
      </Pressable>
      {open ? <View style={styles.block}>{children}</View> : null}
    </View>
  );
}

/** The page's shape while the store, the catalog and the names load. */
function ProgramSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
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
  /** Every public sin, with its shown name. */
  sins: { slug: string; name: string }[];
  entries: CatalogSinProgram[];
  following: ReadonlySet<string>;
  /** The sin a sin page handed over, if any. */
  preselected: string | null;
  onStarted: (slug: string) => void;
  /** Back to the programs being followed (only when there are some). */
  onCancel?: () => void;
}

/** How many sins the chooser shows before «المزيد» (the search finds the rest). */
const CHOICES_SHOWN = 8;

/**
 * Any sin not already followed (search, written programs first); a sin without a written program asks the one
 * category question; starting one runs it beside the others.
 */
function ChooseProgram({ sins, entries, following, preselected, onStarted, onCancel }: ChooseProgramProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const setStore = usePracticeStore((s) => s.setStore);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(preselected);
  const [othersRight, setOthersRight] = useState<boolean | null>(null);
  const [hard, setHard] = useState<boolean | null>(null);
  const [askCode, setAskCode] = useState(false);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const vaultStatus = useVaultState((s) => s.status);

  const choices = useMemo(() => sinChoices(sins, entries, following, query), [sins, entries, following, query]);
  const shown = showAll || query.trim() !== '' ? choices : choices.slice(0, CHOICES_SHOWN);
  // The picked sin stays visible (and first) even when the search or the cap would hide it.
  const pickedChoice = selected ? sinChoices(sins, entries, following).find((c) => c.slug === selected) ?? null : null;
  const list = pickedChoice && !shown.some((c) => c.slug === selected) ? [pickedChoice, ...shown] : shown;

  const written = pickedChoice?.written ?? null;
  const category = written ? written.category : othersRight === null ? null : categoryFromAnswer(othersRight);
  const entry = selected ? programEntry(entries, selected, category) : null;
  const common = catalog.data?.sinPrograms.common;
  // Owner decision D1: the gradual path is offered only where the catalog allows it (haqq_allah programs).
  const asksWill = Boolean(entry?.gradualAllowed && entry.category === 'haqq_allah');

  function choose(slug: string) {
    setSelected(slug);
    setOthersRight(null);
    setHard(null);
  }

  function newProgram() {
    if (!selected || !entry) return null;
    return startProgram({
      sinSlug: selected,
      category: entry.category,
      hardToLeaveAtOnce: asksWill && hard === true,
      startedOn: today(),
    });
  }

  function handleStart() {
    const program = newProgram();
    if (!program) return;
    // The account has no vault yet: the privacy code first, then the program starts already saved.
    if (userId && vaultStatus === 'none') {
      setAskCode(true);
      return;
    }
    setStore((s) => ({ ...s, programs: withProgramStarted(s.programs, program) }));
    onStarted(program.sinSlug);
  }

  async function startWithCode(code: string): Promise<string | null> {
    const program = newProgram();
    if (!program || !userId) return 'failed';
    const err = await createVaultWithCode(userId, code, withProgramStarted(usePracticeStore.getState().store.programs, program));
    if (!err) {
      toast(t('vault.savedToast'));
      onStarted(program.sinSlug);
    }
    return err;
  }

  if (askCode) {
    return <PrivacyCodeForm submitLabel={t('sinProgram.start')} onSubmit={startWithCode} onCancel={() => setAskCode(false)} />;
  }

  return (
    <Section title={t('sinProgram.choose')}>
      <Field
        label={t('sinProgram.searchSins')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="search"
      />
      <View style={styles.options} accessibilityRole="radiogroup">
        {list.map((c) => (
          <CheckRow
            key={c.slug}
            radio
            title={c.name}
            hint={c.written ? (c.written.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')) : undefined}
            checked={selected === c.slug}
            onPress={() => choose(c.slug)}
          />
        ))}
        {list.length === 0 ? (
          <Text variant="small" tone="muted">
            {t('sinProgram.noMatch')}
          </Text>
        ) : null}
      </View>
      {!showAll && query.trim() === '' && choices.length > CHOICES_SHOWN ? (
        <TextLink label={t('common.more')} onPress={() => setShowAll(true)} />
      ) : null}
      {selected && !written ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          <Text variant="heading">{t('sinProgram.categoryQuestion')}</Text>
          <CheckRow radio title={t('sinProgram.yes')} checked={othersRight === true} onPress={() => setOthersRight(true)} />
          <CheckRow radio title={t('sinProgram.no')} checked={othersRight === false} onPress={() => setOthersRight(false)} />
        </View>
      ) : null}
      {entry && asksWill && common ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          <Text variant="heading">{pick(common, 'willQuestion', locale)}</Text>
          <CheckRow radio title={t('sinProgram.yesHard')} checked={hard === true} onPress={() => setHard(true)} />
          <CheckRow radio title={t('sinProgram.noCanLeave')} checked={hard === false} onPress={() => setHard(false)} />
        </View>
      ) : null}
      {entry || onCancel ? (
        <ButtonPair
          size="lg"
          primary={
            entry
              ? { label: t('sinProgram.start'), onPress: handleStart, disabled: asksWill && hard === null, arrow: true }
              : { label: t('common.cancel'), onPress: onCancel!, variant: 'outline' }
          }
          secondary={entry && onCancel ? { label: t('common.cancel'), onPress: onCancel } : null}
        />
      ) : null}
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

type ProgramTab = 'today' | 'journey';

interface ProgramViewProps {
  program: SinProgram;
  /** The written program, or the common one (never null: a running program knows its category). */
  entry: CatalogSinProgram | null;
  sinName: string;
  /** Opens the sheet that switches programs (and starts another). */
  onSwitch: () => void;
  evidenceById: Map<string, QuoteDto> | undefined;
  evidenceLoading: boolean;
  evidenceError: boolean;
}

function ProgramView({ program, entry, sinName, onSwitch, evidenceById, evidenceLoading, evidenceError }: ProgramViewProps) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const common = catalog.data?.sinPrograms.common;
  const [fixOpen, setFixOpen] = useState(false);
  const [tab, setTab] = useState<ProgramTab>('today');
  const setStore = usePracticeStore((s) => s.setStore);
  const loops = sinLoops(program);
  const editProgram = (change: (p: SinProgram) => SinProgram) =>
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (p.sinSlug === program.sinSlug && p.endedAt === undefined ? change(p) : p)) }));
  const tabs: SegmentItem<ProgramTab>[] = [
    { key: 'today', label: t('sinProgram.tabs.today') },
    { key: 'journey', label: t('sinProgram.tabs.journey') },
  ];
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
  const firstWeek = stage.index === 0;
  const notes = notebookEntries(program, d);

  const loopPanel = (
    <LoopsPanel
      kind="sin"
      single
      hideEmpty
      addLabel={t('sinProgram.loopTask.fill')}
      loops={loops}
      onAdd={(draft) => editProgram((p) => addSinLoop(p, newPracticeId(), sinLoopInput(draft)))}
      onUpdate={(id, draft) => editProgram((p) => updateSinLoop(p, id, sinLoopInput(draft)))}
      onRemove={(id) => editProgram((p) => removeSinLoop(p, id))}
    />
  );

  return (
    <>
      {/* The name is page content only (no header role): a tap opens the switch between programs (A-21 a). */}
      <View style={styles.tight}>
        <Pressable
          onPress={onSwitch}
          accessibilityRole="button"
          accessibilityLabel={t('sinProgram.switchLabel', { name: sinName })}
          hitSlop={4}
          style={({ pressed }) => [styles.switcher, pressed && { opacity: 0.7 }]}
        >
          <Text variant="title" style={styles.switcherName}>
            {sinName}
          </Text>
          <Icon icon={ChevronDown} size={20} tone="link" />
        </Pressable>
        <Text variant="small" tone="muted">
          {`${program.path === 'gradual' ? t('sinProgram.pathGradual') : t('sinProgram.pathCut')} · ${
            program.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')
          }`}
        </Text>
      </View>

      <SegmentTabs items={tabs} value={tab} onChange={setTab} />

      {tab === 'today' ? (
        <>
          {todayLimitText ? (
            <NextStep>
              <Text variant="body">{t('sinProgram.limits.today', { limit: todayLimitText })}</Text>
            </NextStep>
          ) : null}

          {/* ONE counter line (A-21 a): held days of the window and the days since the start or the last repentance. */}
          <Text variant="body" weight="medium">
            {`${t('sinProgram.counters.held', { n: String(counters.held), total: String(counters.window) })} · ${t(
              counters.fromStart ? 'sinProgram.counters.sinceStart' : 'sinProgram.counters.sinceRepentance',
              { count: counters.daysSinceRepentance },
            )}`}
          </Text>

          {/* Outlined: the check-in's «سجّل» is the area's one solid (A-08). */}
          <Button
            label={t('sinProgram.moment.open')}
            icon={Waves}
            variant="outline"
            size="lg"
            onPress={() => {
              setMomentSource(program.sinSlug);
              router.push('/practice/moment');
            }}
          />

          {/* After a slip: the story of the man who killed a hundred, by id only (hidden until the id is filled). */}
          {showAfterFall ? <StoryLine moment="afterFall" /> : null}

          <CheckInForm program={program} onFell={() => setFixOpen(true)} />

          {showAfterFall && common ? (
            <SubSection title={pick(common.afterFall, 'title', locale)} tone="link">
              <StageBody content={common.afterFall} />
              {hopeId ? <EvidenceList ids={[hopeId]} {...evidenceProps} title={t('sinProgram.counters.hope')} /> : null}
              <Button label={t('sinProgram.fixit.open')} onPress={() => setFixOpen(true)} />
            </SubSection>
          ) : null}
        </>
      ) : null}

      {tab === 'journey' ? (
        <>
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
              {/* This week's task; in the first week it is «حلقة المعصية», filled once (F-11 a). */}
              <NextStep title={t('sinProgram.stages.taskTitle')}>
                {firstWeek ? (
                  <View style={styles.block}>
                    {loops.length > 0 ? (
                      <View style={styles.taskDone}>
                        <Icon icon={Check} size={16} tone="link" />
                        <Text variant="body">{t('sinProgram.loopTask.done')}</Text>
                      </View>
                    ) : (
                      <>
                        <Text variant="body">{t('sinProgram.loopTask.title')}</Text>
                        <Text variant="small" tone="muted">
                          {t('loops.sin.lead')}
                        </Text>
                      </>
                    )}
                    {loopPanel}
                  </View>
                ) : (
                  <Text variant="body">{t(`sinProgram.stages.tasks.${STAGE_TASKS[stage.stage]}`)}</Text>
                )}
              </NextStep>
              <Text variant="small" tone="muted">
                {t('sinProgram.stageHint')}
              </Text>
            </View>
          ) : null}

          {/* After the first week the loop stays at hand, folded (filled once, edited there). */}
          {!firstWeek ? <Fold title={t('loops.sin.title')}>{loopPanel}</Fold> : null}

          <WeakPatternCard program={program} actions={actions} />

          {/* The texts right under the stage that asks to read them («اعرف ضررها»), titled for what they do (A-03, O-05). */}
          {textIds.length > 0 ? (
            <>
              <SectionDivider />
              <EvidenceList
                ids={textIds}
                {...evidenceProps}
                title={t('sinProgram.textsTitle')}
                subtitle={sinName}
                limit={3}
                moreHref={`/sins/${program.sinSlug}`}
              />
            </>
          ) : null}

          {actions.length > 0 ? (
            <SubSection title={t('sinProgram.actions')}>
              <BulletList items={actions} />
            </SubSection>
          ) : null}

          {entry?.alternatives && entry.alternatives.length > 0 ? <Alternatives keys={entry.alternatives} /> : null}

          {entry?.help && common ? <NextStep title={t('sinProgram.help')}>{pick(common, 'help', locale)}</NextStep> : null}

          <SectionDivider />
          {/* The notebook: the evening check-ins and their notes, newest first, folded. */}
          <Fold title={t('sinProgram.notebook')} count={notes.length}>
            <Notebook program={program} />
          </Fold>
        </>
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
    </>
  );
}

/**
 * «متى تضعف؟»: derived on this device from the trigger chips, never sent; the summary after 14 tagged check-ins, and
 * before that one line on how it fills.
 */
function WeakPatternCard({ program, actions }: { program: SinProgram; actions: readonly string[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const limitLabel = useLimitLabel(actions);
  const pattern = weakPattern(program);
  if (!pattern) {
    return (
      <View style={styles.pattern}>
        <Text variant="heading" accessibilityRole="header">
          {t('sinProgram.pattern.title')}
        </Text>
        <Text variant="small" tone="muted">
          {t('sinProgram.pattern.waiting')}
        </Text>
      </View>
    );
  }
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
                  size="sm"
                  accessibilityLabel={`${t('sinProgram.addAlternative')}: ${pick(h, 'title', locale)}`}
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
    toast(t('sinProgram.checkInSaved'));
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

/** «دفتري الخاص»: past check-ins with their notes, newest first (inside its fold). The name of the sin is not in it. */
function Notebook({ program }: { program: SinProgram }) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const entries = notebookEntries(program, today());
  if (entries.length === 0) {
    return (
      <Text variant="small" tone="muted">
        {t('sinProgram.notebookEmpty')}
      </Text>
    );
  }
  return (
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
  );
}
