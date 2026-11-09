/**
 * «قضاء الفوائت» (owner round 6, C-01a; practice-core qada.ts), reached from «اليوم › الفرائض»: a member who owes
 * prayers enters how many — per prayer, or one total — and a pace (prayers a day), then logs what he makes up. A
 * circular chart (react-native-svg) shows how much is done. Kind words only: no «فاتتك», no failure counts; the pace is
 * his own and «on your way» is said without pressure. Synced with the account (settings.qada + qadaLogs).
 * - No plan: the set-up (total or per prayer, the pace chips or a typed pace) and «ابدأ».
 * - A plan: the ring and «أنجزت n من m», today against the pace, the days left at this pace; today's make-ups per
 *   prayer with − / + (a «total» plan logs one line); «تعديل الخطة» in a sheet; «احذف الخطة» in «⋯», confirmed (the
 *   logs stay).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Minus, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import {
  FARD_LABELS,
  FARD_PRAYERS,
  logQada,
  qadaCountOn,
  qadaProgress,
  QADA_KEYS,
  QADA_OWED_MAX,
  QADA_PER_DAY_MAX,
  setQadaPlan,
  validateQadaPlan,
  type QadaKey,
  type QadaPlan,
} from '@thekra/practice-core';
import { parseLogAmount, shortDate } from '@/lib/practice/format';
import { QADA_PACES } from '@/lib/practice/hub-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { QadaRing } from '@/components/practice/habits/QadaRing';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, BottomSheet, ButtonPair, Chip, ErrorText, Field, IconButton, Loading, PageHeader, Screen, Section, SectionDivider, SegmentTabs, Text, Wrap, toast } from '@/ui';

type Mode = 'total' | 'perPrayer';

const makeStyles = (t: Theme) => ({
  ring: { alignItems: 'center' as const, gap: space.sm },
  stack: { gap: space.md },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 56, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  name: { flex: 1, minWidth: 0 },
  count: { minWidth: 32, textAlign: 'center' as const, fontVariant: ['tabular-nums' as const] },
  field: { flex: 1 },
  owedRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  numInput: { writingDirection: 'ltr' as const, textAlign: 'center' as const },
});

export default function QadaScreen() {
  const { t } = useTranslation();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const [editing, setEditing] = useState(false);
  if (!hydrated) return <Loading />;
  const d = today();
  const progress = qadaProgress(store, d);
  const plan = store.settings.qada;
  return (
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen
        options={{
          title: t('habitsHub.qada.title'),
          headerRight: plan
            ? () => (
                <ActionMenu
                  items={[
                    { label: t('habitsHub.qada.edit'), icon: PencilLine, onPress: () => setEditing(true) },
                    {
                      label: t('habitsHub.qada.remove'),
                      icon: Trash2,
                      destructive: true,
                      onPress: () => {
                        setStore((s) => setQadaPlan(s, null));
                        toast(t('habitsHub.qada.removedToast'));
                      },
                      confirm: { title: t('habitsHub.qada.remove'), message: t('habitsHub.qada.removeBody'), confirmLabel: t('common.delete') },
                    },
                  ]}
                />
              )
            : undefined,
        }}
      />
      <PageHeader title={t('habitsHub.qada.title')} lead={t('habitsHub.qada.lead')} />
      {!plan || !progress ? (
        <PlanForm onDone={() => toast(t('habitsHub.qada.startedToast'))} />
      ) : (
        <>
          <ProgressView />
          <SectionDivider />
          <TodayLog plan={plan} />
          <BottomSheet visible={editing} title={t('habitsHub.qada.edit')} onClose={() => setEditing(false)}>
            <PlanForm
              initial={plan}
              onDone={() => {
                setEditing(false);
                toast(t('habitsHub.qada.savedToast'));
              }}
            />
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}

function ProgressView() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const p = qadaProgress(store, today());
  if (!p) return null;
  return (
    <View style={styles.ring}>
      <QadaRing done={p.doneTotal} owed={p.owedTotal} size={148} label={t('habitsHub.qada.ringLabel', { done: p.doneTotal, owed: p.owedTotal })} />
      <Text variant="heading" align="center">
        {t('habitsHub.qada.doneOf', { done: p.doneTotal, owed: p.owedTotal })}
      </Text>
      <Text variant="small" tone="muted" align="center">
        {p.remaining === 0
          ? t('habitsHub.qada.finished')
          : `${t('habitsHub.qada.todayLine', { done: p.today, pace: p.perDay })} · ${t('habitsHub.qada.daysLeft', { count: p.daysLeft })}${p.finishOn ? ` · ${t('habitsHub.qada.finishOn', { date: shortDate(p.finishOn) })}` : ''}`}
      </Text>
      {p.remaining > 0 && p.doneTotal >= p.expectedByToday ? (
        <Text variant="small" tone="link" align="center">
          {t('habitsHub.qada.onPace')}
        </Text>
      ) : null}
    </View>
  );
}

/** Today's make-ups: a row per prayer owed (or one «total» row), each with − and +. */
function TodayLog({ plan }: { plan: QadaPlan }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const d = today();
  const keys: QadaKey[] = QADA_KEYS.filter((k) => plan.owed[k] > 0);
  const label = (k: QadaKey) => (k === 'any' ? t('habitsHub.qada.anyPrayer') : FARD_LABELS[locale].prayers[k]);
  const add = (k: QadaKey, n: number) => setStore((s) => logQada(s, { date: d, prayer: k, add: n, today: d }));
  return (
    <Section title={t('habitsHub.qada.todayTitle')} lead={t('habitsHub.qada.todayLead')}>
      <View>
        {keys.map((k, i) => {
          const count = qadaCountOn(store, d, k);
          return (
            <View key={k} style={[styles.row, i === keys.length - 1 && styles.rowLast]}>
              <Text variant="body" style={styles.name}>
                {label(k)}
              </Text>
              <IconButton icon={Minus} label={t('habitsHub.qada.less', { prayer: label(k) })} onPress={() => add(k, -1)} disabled={count === 0} bordered />
              <Text variant="heading" style={styles.count}>
                {String(count)}
              </Text>
              <IconButton icon={Plus} label={t('habitsHub.qada.more', { prayer: label(k) })} onPress={() => add(k, 1)} bordered />
            </View>
          );
        })}
      </View>
    </Section>
  );
}

/** Owed prayers (a total, or per prayer) and the pace. */
function PlanForm({ initial, onDone }: { initial?: QadaPlan; onDone: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const setStore = usePracticeStore((s) => s.setStore);
  const perPrayerStart = initial ? FARD_PRAYERS.some((k) => initial.owed[k] > 0) : false;
  const [mode, setMode] = useState<Mode>(perPrayerStart ? 'perPrayer' : 'total');
  const [values, setValues] = useState<Record<QadaKey, string>>(() =>
    Object.fromEntries(QADA_KEYS.map((k) => [k, initial && initial.owed[k] > 0 ? String(initial.owed[k]) : ''])) as Record<QadaKey, string>,
  );
  const [pace, setPace] = useState<string>(String(initial?.perDay ?? 1));
  const [error, setError] = useState<string | null>(null);
  const num = (v: string) => parseLogAmount(v) ?? 0;

  function save() {
    const owed = Object.fromEntries(QADA_KEYS.map((k) => [k, 0])) as Record<QadaKey, number>;
    if (mode === 'total') owed.any = num(values.any);
    else for (const k of FARD_PRAYERS) owed[k] = num(values[k]);
    const plan: QadaPlan = { owed, perDay: num(pace), startedOn: initial?.startedOn ?? today() };
    const problem = validateQadaPlan(plan);
    if (problem) {
      setError(problem.includes('perDay') ? t('habitsHub.qada.paceError', { max: QADA_PER_DAY_MAX }) : t('habitsHub.qada.owedError', { max: QADA_OWED_MAX }));
      return;
    }
    setStore((s) => setQadaPlan(s, plan));
    onDone();
  }

  const input = (k: QadaKey, label: string) => (
    <Field
      key={k}
      label={label}
      value={values[k]}
      onChangeText={(v) => {
        setValues((old) => ({ ...old, [k]: v }));
        setError(null);
      }}
      keyboardType="number-pad"
      maxLength={5}
      placeholder="0"
      style={styles.numInput}
    />
  );

  return (
    <View style={styles.stack}>
      <SegmentTabs
        items={[
          { key: 'total', label: t('habitsHub.qada.modeTotal') },
          { key: 'perPrayer', label: t('habitsHub.qada.modePerPrayer') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'total' ? input('any', t('habitsHub.qada.totalLabel')) : FARD_PRAYERS.map((k) => input(k, FARD_LABELS[locale].prayers[k]))}
      <Text variant="heading" accessibilityRole="header">
        {t('habitsHub.qada.paceTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('habitsHub.qada.paceHint')}
      </Text>
      <Wrap>
        {QADA_PACES.map((p) => (
          <Chip key={p} label={t('habitsHub.qada.perDay', { count: p })} selected={num(pace) === p} onPress={() => setPace(String(p))} />
        ))}
      </Wrap>
      <Field label={t('habitsHub.qada.paceOther')} value={pace} onChangeText={setPace} keyboardType="number-pad" maxLength={2} style={styles.numInput} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <ButtonPair size="lg" primary={{ label: initial ? t('habitsHub.qada.save') : t('habitsHub.qada.start'), onPress: save }} secondary={initial ? null : { label: t('common.cancel'), onPress: () => router.back() }} />
    </View>
  );
}
