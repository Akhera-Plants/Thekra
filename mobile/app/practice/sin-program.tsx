/**
 * «ترك المعصية»: LOCAL ONLY (roadmap §0.1, §4). The chosen sin, the check-ins and the notes live in the
 * practice-core Store on this device and are never synced, sent, logged or shown in a notification.
 * The only network calls here are public and identical for every user: the catalog, the evidence of ALL
 * programs at once (useSinProgramEvidence) and the public sins list for names.
 * The sin's name is never a title: the native header and the page title stay generic («ترك المعصية», see
 * practice/_layout.tsx), and the name shows only as plain text inside the page, never as a header element.
 *
 * Flow: choose a catalog program → the willpower question (only when the program's `gradualAllowed` is true
 * and it is a sin against the right of Allah: owner decision D1) → practice-core `startProgram`. Then the
 * current stage (`currentStage`) with its reviewed title/body, practical steps, alternatives, evidence, the
 * daily check-in (held / weak / fell_repented + private note), `summary` (counts of days only) and, after
 * «وقعت ثم تبت», the `afterFall` («خربانة؟ صلّحها») content, and «دفتري الخاص» (past check-ins with their notes,
 * newest first, shown on this screen only). Several programs run side by side, as on the website: each has its own
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
import { Alert, KeyboardAvoidingView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Plus, ShieldCheck } from 'lucide-react-native';
import {
  activePrograms,
  addDays,
  afterFall,
  checkIn,
  currentStage,
  startProgram,
  stagesFor,
  summary,
  type CheckInValue,
  type SinProgram,
} from '@thekra/practice-core';
import { usePracticeCatalog, useSinProgramEvidence } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { pick, pickList, type CatalogSinProgram, type StageContent } from '@/lib/practice/catalog-types';
import { shortDate } from '@/lib/practice/format';
import { ensurePermission } from '@/lib/practice/notifications';
import { pendingProgram, setPendingProgram, today, usePracticeStore } from '@/lib/practice/practice-store';
import { notebookEntries, withProgramEnded, withProgramStarted } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useVaultState, wipeSinProgramEverywhere } from '@/lib/practice/vault-runner';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { QuoteDto } from '@/lib/types/api';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { TimeField } from '@/components/practice/editors';
import { SinProgramGuard } from '@/components/practice/SinProgramGuard';
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
/** `summary` window: the last 30 days, today included. */
const SUMMARY_SPAN = 29;

const makeStyles = (t: Theme) => ({
  flex: { flex: 1 },
  block: { gap: space.md },
  tight: { gap: space.xs },
  options: { gap: space.sm },
  note: { minHeight: 96, textAlignVertical: 'top' as const },
  stages: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  stagePill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  stagePillCurrent: { borderColor: t.colors.primary },
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

  if (!hydrated || catalog.isLoading || sins.isLoading) return <ProgramSkeleton />;
  if (catalog.isError || !catalog.data) {
    return (
      <Screen edges={['bottom']}>
        <PageHeader eyebrow={t('practice.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
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
  const showChooser = programs.length === 0 || (choosing ?? preselected !== null);
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
        <PageHeader eyebrow={t('practice.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
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
      <PageHeader eyebrow={t('practice.title')} title={t('sinProgram.title')} lead={t('sinProgram.lead')} />
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
  const d = today();
  const stage = currentStage(program, d);
  const stageKeys = stagesFor(program.category);
  const stageContent = common?.stages[stage.stage];
  const todayCheckIn = program.checkIns.find((c) => c.date === d);
  const showAfterFall = todayCheckIn?.value === 'fell_repented' && afterFall(program) === 'fixit';
  const actions = entry ? pickList(entry.actionsAr, entry.actionsEn, locale) : [];
  const gradual = entry && program.path === 'gradual' ? pickList(entry.gradualStepsAr, entry.gradualStepsEn, locale) : [];
  const evidenceProps = { byId: evidenceById, loading: evidenceLoading, error: evidenceError };

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

      {gradual.length > 0 ? (
        <NextStep title={t('sinProgram.gradualSteps')}>
          {gradual.map((step, i) => (
            <Text key={step} variant="small">{`${i + 1}. ${step}`}</Text>
          ))}
        </NextStep>
      ) : null}

      {stageContent && common ? (
        <View style={styles.block}>
          <Text variant="eyebrow">
            {`${t('sinProgram.stage', { n: String(stage.index + 1), total: String(stageKeys.length) })} · ${t('sinProgram.since', {
              date: shortDate(stage.since),
            })}`}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {pick(stageContent, 'title', locale)}
          </Text>
          <StageBody content={stageContent} />
          <Text variant="small" tone="muted">
            {t('sinProgram.stageHint')}
          </Text>
          <View style={styles.stages}>
            {stageKeys.map((key, index) => {
              const content = common.stages[key];
              if (!content) return null;
              const current = index === stage.index;
              return (
                <View key={key} style={[styles.stagePill, current && styles.stagePillCurrent]} accessibilityState={{ selected: current }}>
                  <Text variant="caption" tone={current ? 'link' : 'muted'}>
                    {pick(content, 'title', locale)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      <EvidenceList ids={stageContent?.evidence} {...evidenceProps} />

      {actions.length > 0 ? (
        <SubSection title={t('sinProgram.actions')}>
          <BulletList items={actions} />
        </SubSection>
      ) : null}

      {entry?.alternatives && entry.alternatives.length > 0 ? <Alternatives keys={entry.alternatives} /> : null}

      {entry?.help && common ? <NextStep title={t('sinProgram.help')}>{pick(common, 'help', locale)}</NextStep> : null}

      <CheckInForm program={program} />

      <Notebook program={program} />

      {showAfterFall && common ? (
        <SubSection title={pick(common.afterFall, 'title', locale)} tone="link">
          <StageBody content={common.afterFall} />
          <EvidenceList ids={common.afterFall.evidence} {...evidenceProps} />
        </SubSection>
      ) : null}

      <EvidenceList ids={entry?.evidence} {...evidenceProps} />
    </>
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

/** «كيف كان يومك؟»: one of three, an optional private note (on this device only), then counts of days only. */
function CheckInForm({ program }: { program: SinProgram }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const [value, setValue] = useState<CheckInValue | null>(null);
  const [note, setNote] = useState('');
  const d = today();
  const todayCheckIn = program.checkIns.find((c) => c.date === d);
  const counts = summary(program, addDays(d, -SUMMARY_SPAN), d);

  function save() {
    if (!value) return;
    const trimmed = note.trim();
    setStore((s) => ({
      ...s,
      programs: s.programs.map((p) => (p.sinSlug === program.sinSlug ? checkIn(p, d, value, trimmed || undefined) : p)),
    }));
    setNote('');
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
      <Text variant="small" tone="muted">
        {t('sinProgram.summary', { days: String(counts.daysCheckedIn) })}
      </Text>
    </SubSection>
  );
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
            <Text variant="small" tone="muted">{`${shortDate(c.date)} · ${t(CHECK_IN_KEYS[c.value])}`}</Text>
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
