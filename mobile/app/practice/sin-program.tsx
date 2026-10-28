/**
 * «ترك المعصية» — LOCAL ONLY (roadmap §0.1, §4). The chosen sin, the check-ins and the notes live in the
 * practice-core Store on this device and are never synced, sent, logged or shown in a notification.
 * The only network calls here are public and identical for every user: the catalog, the evidence of ALL
 * programs at once (useSinProgramEvidence) and the public sins list for names.
 *
 * Flow: choose a catalog program → the willpower question (only when the program's `gradualAllowed` is true
 * and it is a sin against the right of Allah: owner decision D1) → practice-core `startProgram`. Then the
 * current stage (`currentStage`) with its reviewed title/body, practical steps, alternatives, evidence, the
 * daily check-in (held / weak / fell_repented + private note), `summary` (counts of days only) and, after
 * «وقعت ثم تبت», the `afterFall` («خربانة؟ صلّحها») content. «احذف كل بيانات البرنامج» wipes it all at once
 * (no confirmation step): local data, the vault key, the server vault, and the private reminders.
 */

import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
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
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { QuoteDto } from '@/lib/types/api';
import { ErrorState } from '@/components/ErrorState';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { TimeField } from '@/components/practice/editors';
import { VaultCard } from '@/components/practice/VaultCard';
import { useAuthStore } from '@/lib/stores/auth-store';
import { wipeSinProgramEverywhere } from '@/lib/practice/vault-runner';
import {
  ArabicBody,
  Body,
  Button,
  Card,
  Chip,
  LinkRow,
  Loading,
  Row,
  Screen,
  SectionTitle,
  SwitchRow,
  Wrap,
  practiceStyles,
} from '@/components/practice/ui';

const CHECK_IN_KEYS: Record<CheckInValue, string> = {
  held: 'sinProgram.held',
  weak: 'sinProgram.weak',
  fell_repented: 'sinProgram.fell',
};

export default function SinProgramScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const program = usePracticeStore((s) => s.store.programs[0]);
  const catalog = usePracticeCatalog(locale);
  const evidence = useSinProgramEvidence(catalog.data, locale);
  const sins = useSins({ limit: 100 });
  const userId = useAuthStore((s) => s.user?.id ?? null);

  if (!hydrated || catalog.isLoading) return <Loading />;
  if (catalog.isError || !catalog.data) {
    return <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />;
  }

  const sinName = (slug: string) => {
    const s = sins.data?.find((x) => x.slug === slug);
    if (!s) return slug;
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  };

  return (
    <Screen>
      <Card tone="private">
        <Body small>{t('sinProgram.privacy')}</Body>
      </Card>
      {userId ? (
        <VaultCard userId={userId} hasProgram={Boolean(program)} />
      ) : (
        <Body small muted>
          {t('vault.signInHint')}
        </Body>
      )}
      {program ? (
        <ProgramView
          program={program}
          entry={catalog.data.sinPrograms.programs.find((p) => p.sin === program.sinSlug)}
          sinName={sinName(program.sinSlug)}
          evidenceById={evidence.data}
          evidenceLoading={evidence.isLoading}
          evidenceError={evidence.isError}
        />
      ) : (
        <ChooseProgram programs={catalog.data.sinPrograms.programs} sinName={sinName} />
      )}
    </Screen>
  );
}

function ChooseProgram({ programs, sinName }: { programs: CatalogSinProgram[]; sinName: (slug: string) => string }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const setStore = usePracticeStore((s) => s.setStore);
  const [selected, setSelected] = useState<CatalogSinProgram | null>(null);
  const [hard, setHard] = useState<boolean | null>(null);

  const common = catalog.data?.sinPrograms.common;
  // Owner decision D1: the gradual path is offered only where the catalog allows it (haqq_allah programs).
  const asksWill = Boolean(selected?.gradualAllowed && selected.category === 'haqq_allah');

  function start() {
    if (!selected) return;
    const program = startProgram({
      sinSlug: selected.sin,
      category: selected.category,
      hardToLeaveAtOnce: asksWill && hard === true,
      startedOn: today(),
    });
    setStore((s) => ({ ...s, programs: [program] }));
  }

  return (
    <>
      <SectionTitle>{t('sinProgram.choose')}</SectionTitle>
      <Card>
        {programs.map((p) => (
          <LinkRow
            key={p.sin}
            label={`${selected?.sin === p.sin ? '✓ ' : ''}${sinName(p.sin)}`}
            hint={p.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')}
            onPress={() => {
              setSelected(p);
              setHard(null);
            }}
          />
        ))}
      </Card>
      {selected && asksWill && common ? (
        <Card>
          <Body>{pick(common, 'willQuestion', locale)}</Body>
          <Wrap>
            <Chip label={t('sinProgram.yesHard')} selected={hard === true} onPress={() => setHard(true)} />
            <Chip label={t('sinProgram.noCanLeave')} selected={hard === false} onPress={() => setHard(false)} />
          </Wrap>
        </Card>
      ) : null}
      {selected ? (
        <Button label={t('sinProgram.start')} onPress={start} disabled={asksWill && hard === null} />
      ) : null}
    </>
  );
}

function StageText({ content }: { content: StageContent }) {
  const locale = useUiLocale();
  const body = pick(content, 'body', locale);
  return (
    <>
      <Body>{pick(content, 'title', locale)}</Body>
      {locale === 'ar' ? <ArabicBody>{body}</ArabicBody> : <Body>{body}</Body>}
    </>
  );
}

function ProgramView({
  program,
  entry,
  sinName,
  evidenceById,
  evidenceLoading,
  evidenceError,
}: {
  program: SinProgram;
  entry: CatalogSinProgram | undefined;
  sinName: string;
  evidenceById: Map<string, QuoteDto> | undefined;
  evidenceLoading: boolean;
  evidenceError: boolean;
}) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const prefs = usePracticeStore((s) => s.prefs);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [value, setValue] = useState<CheckInValue | null>(null);
  const [note, setNote] = useState('');

  const common = catalog.data?.sinPrograms.common;
  const habits = catalog.data?.habits ?? [];
  const d = today();
  const stage = currentStage(program, d);
  const total = stagesFor(program.category).length;
  const stageContent = common?.stages[stage.stage];
  const todayCheckIn = program.checkIns.find((c) => c.date === d);
  const counts = summary(program, addDays(d, -29), d);
  const showAfterFall = todayCheckIn?.value === 'fell_repented' && afterFall(program) === 'fixit';
  const planIds = new Set(plans.map((p) => p.habitKey ?? p.id));

  function save() {
    if (!value) return;
    const trimmed = note.trim();
    setStore((s) => ({
      ...s,
      programs: s.programs.map((p) => (p.sinSlug === program.sinSlug ? checkIn(p, d, value, trimmed || undefined) : p)),
    }));
    setNote('');
  }

  async function toggleReminders(on: boolean) {
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      Alert.alert(t('practice.permissionDenied'));
      return;
    }
    setPrefs((p) => ({ ...p, sinReminders: on }));
  }

  // «خروج آمن»: one tap erases everything at once (roadmap §4.2), no confirmation step in between.
  function wipe() {
    // Local programs and notes, the vault key (memory + keystore) and, signed in, the vault on the server.
    void wipeSinProgramEverywhere(userId).then(() => Alert.alert(t('sinProgram.wiped')));
  }

  const actions = entry ? pickList(entry.actionsAr, entry.actionsEn, locale) : [];
  const gradual = entry && program.path === 'gradual' ? pickList(entry.gradualStepsAr, entry.gradualStepsEn, locale) : [];

  return (
    <>
      <SectionTitle>{sinName}</SectionTitle>
      <Body muted small>
        {program.path === 'gradual' ? t('sinProgram.pathGradual') : t('sinProgram.pathCut')} ·{' '}
        {program.category === 'haqq_ibad' ? t('sinProgram.categoryIbad') : t('sinProgram.categoryAllah')}
      </Body>

      {stageContent ? (
        <Card tone="info">
          <Body small muted>
            {t('sinProgram.stage', { n: String(stage.index + 1), total: String(total) })} ·{' '}
            {t('sinProgram.since', { date: shortDate(stage.since) })}
          </Body>
          <StageText content={stageContent} />
          <Body small muted>
            {t('sinProgram.stageHint')}
          </Body>
        </Card>
      ) : null}
      <EvidenceList ids={stageContent?.evidence} byId={evidenceById} loading={evidenceLoading} error={evidenceError} />

      {entry?.help && common ? (
        <Card tone="warning">
          <Body>{t('sinProgram.help')}</Body>
          <Body>{pick(common, 'help', locale)}</Body>
        </Card>
      ) : null}

      <Card>
        <Body>{t('sinProgram.checkInTitle')}</Body>
        {todayCheckIn ? (
          <Body muted small>
            {t('sinProgram.todayValue', { value: t(CHECK_IN_KEYS[todayCheckIn.value]) })}
          </Body>
        ) : null}
        <Wrap>
          {(['held', 'weak', 'fell_repented'] as const).map((v) => (
            <Chip key={v} label={t(CHECK_IN_KEYS[v])} selected={value === v} onPress={() => setValue(v)} />
          ))}
        </Wrap>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('sinProgram.note')}
          multiline
          style={[practiceStyles.input, { minHeight: 64, textAlignVertical: 'top' }]}
          autoComplete="off"
          accessibilityLabel={t('sinProgram.note')}
        />
        <Button label={t('sinProgram.saveCheckIn')} onPress={save} disabled={!value} compact />
        <Body muted small>
          {t('sinProgram.summary', { days: String(counts.daysCheckedIn) })}
        </Body>
      </Card>

      {showAfterFall && common ? (
        <>
          <Card tone="info">
            <StageText content={common.afterFall} />
          </Card>
          <EvidenceList ids={common.afterFall.evidence} byId={evidenceById} loading={evidenceLoading} error={evidenceError} />
        </>
      ) : null}

      {actions.length > 0 ? (
        <Card>
          <Body>{t('sinProgram.actions')}</Body>
          {actions.map((a) => (
            <Body key={a}>• {a}</Body>
          ))}
        </Card>
      ) : null}

      {gradual.length > 0 ? (
        <Card>
          <Body>{t('sinProgram.gradualSteps')}</Body>
          {gradual.map((a, i) => (
            <Body key={a}>
              {i + 1}. {a}
            </Body>
          ))}
        </Card>
      ) : null}

      {entry?.alternatives && entry.alternatives.length > 0 ? (
        <Card>
          <Body>{t('sinProgram.alternatives')}</Body>
          {entry.alternatives.map((key) => {
            const h = habits.find((x) => x.key === key);
            if (!h) return null;
            return (
              <Row key={key} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body>{pick(h, 'title', locale)}</Body>
                </View>
                {planIds.has(key) ? (
                  <Body muted small>
                    {t('sinProgram.added')}
                  </Body>
                ) : (
                  <Button
                    label={t('sinProgram.addAlternative')}
                    onPress={() => router.push({ pathname: '/practice/add', params: { habit: key } })}
                    variant="outline"
                    compact
                  />
                )}
              </Row>
            );
          })}
        </Card>
      ) : null}

      <EvidenceList ids={entry?.evidence} byId={evidenceById} loading={evidenceLoading} error={evidenceError} />

      <SectionTitle>{t('practice.reminders')}</SectionTitle>
      <Card>
        <SwitchRow
          label={t('sinProgram.reminders')}
          hint={t('sinProgram.remindersHint')}
          value={prefs.sinReminders}
          onValueChange={(v) => void toggleReminders(v)}
        />
        {prefs.sinReminders ? (
          <TimeField
            label={t('sinProgram.time')}
            value={prefs.sinReminderTime}
            onChange={(time) => setPrefs((p) => ({ ...p, sinReminderTime: time }))}
          />
        ) : null}
      </Card>

      <Button label={t('sinProgram.wipe')} onPress={wipe} variant="danger" />
      <Body muted small>
        {t('sinProgram.wipeHint')}
      </Body>
    </>
  );
}
