/**
 * «صلّحها» for a good-deed habit (owner round 3, decision 1; round 5, F-08 a / F-12 a), opened from the habit's row in
 * «ورد اليوم» (and from its page):
 * - after two missed asked days in a row (practice-core `makeUpOffer`): «أتبع السيئة الحسنة: اختر عملًا واحدًا اليوم»
 *   first, the deeds of `PLEDGE_DEED_INFO` (each with «الدليل»: public Quote ids read from the API), then «أتصدّق» and
 *   «عمل أختاره بنفسي»; once one is chosen, the deed and «فعلته»;
 * - then the steps, each with its own action and its strategy line in the moment it helps (F-12 a): (1) «لا تفوّتها
 *   مرتين»: log the least of it today; (2) «اقضِ ما فاتك»: log yesterday while it can still be made up (practice-core
 *   `canMakeUp`, until noon today); (3) «خفّف المقدار»: open the habit to lower its amount.
 * Every change goes through practice-core; nothing is said about failing.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpenText, CircleCheck } from 'lucide-react-native';
import {
  addDays,
  baseAmount,
  canMakeUp,
  chooseMakeUp,
  logForDay,
  MAKE_UP_TEXTS,
  makeUpOffer,
  markMakeUpDone,
  minimumToLog,
  PLEDGE_DEED_INFO,
  pledgeEvidence,
  requiredOn,
  updatePlan,
  type LocalDate,
  type Plan,
  type PledgeAction,
} from '@thekra/practice-core';
import { useEvidence } from '@/lib/api/practice';
import type { CatalogHabit } from '@/lib/practice/catalog-types';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, CheckRow, Field, IconButton, Notice, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  step: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  num: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.ring,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  deed: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  deedChoice: { flex: 1, minWidth: 0 },
  group: { gap: space.sm },
});

export interface HabitFixSheetProps {
  visible: boolean;
  onClose: () => void;
  plan: Plan | undefined;
  habit: CatalogHabit | undefined;
  title: string;
  today: LocalDate;
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.step}>
      <View style={styles.head}>
        <View style={styles.num}>
          <Text variant="small" tone="link">
            {String(n)}
          </Text>
        </View>
        <Text variant="heading" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {body}
      </Text>
      {children}
    </View>
  );
}

export function HabitFixSheet({ visible, onClose, plan, habit, title, today }: HabitFixSheetProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const setStore = usePracticeStore((s) => s.setStore);
  const planDays = usePlanDays();
  const [evidenceOf, setEvidenceOf] = useState<PledgeAction | null>(null);
  if (!plan) return null;
  const offer = makeUpOffer(store, plan, today, { ...planDays, heart });
  const yesterday = addDays(today, -1);
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const amount = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
  const doneToday = plan.log[today] ?? 0;
  const least = minimumToLog(plan, today) ?? Math.max(0, requiredOn(plan, today) - doneToday);
  const makeUp = canMakeUp(yesterday, today) && (plan.log[yesterday] ?? 0) <= 0;
  const yesterdayAmount = baseAmount(plan);
  let n = 0;

  function log(date: LocalDate, value: number) {
    if (!plan || value <= 0) return;
    setStore((s) => updatePlan(s, plan.id, (p) => logForDay(p, date, value, today)));
    toast(t('practice.plan.logged'));
    onClose();
  }

  return (
    <>
      <BottomSheet visible={visible && evidenceOf === null} title={`${t('myHabits.fixTitle')}: ${title}`} onClose={onClose}>
        {offer ? <MakeUpPart plan={plan} on={offer.on} today={today} onEvidence={setEvidenceOf} /> : null}
        <Step n={++n} title={t('myHabits.fixSteps.least.title')} body={t('myHabits.fixSteps.least.body')}>
          {least > 0 ? <Button label={t('myHabits.fixSteps.least.action', { amount: amount(least) })} onPress={() => log(today, least)} block /> : null}
        </Step>
        {makeUp ? (
          <Step n={++n} title={t('myHabits.fixSteps.makeUp.title')} body={t('myHabits.fixSteps.makeUp.body')}>
            <Button
              label={t('myHabits.fixSteps.makeUp.action', { amount: amount(yesterdayAmount) })}
              onPress={() => log(yesterday, yesterdayAmount)}
              variant="outline"
              block
            />
          </Step>
        ) : null}
        <Step n={++n} title={t('myHabits.fixSteps.lighter.title')} body={t('myHabits.fixSteps.lighter.body')}>
          <Button
            label={t('myHabits.fixSteps.lighter.action')}
            onPress={() => {
              onClose();
              router.push(`/practice/plan/${plan.id}`);
            }}
            variant="outline"
            arrow
            block
          />
        </Step>
      </BottomSheet>
      <DeedEvidenceSheet action={evidenceOf} onClose={() => setEvidenceOf(null)} />
    </>
  );
}

/** «أتبع السيئة الحسنة»: choose one deed for today, then «فعلته». */
function MakeUpPart({ plan, on, today, onEvidence }: { plan: Plan; on: LocalDate; today: LocalDate; onEvidence: (a: PledgeAction) => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const chosen = heart.makeUps?.find((m) => m.planId === plan.id && m.on === on) ?? null;
  const [picked, setPicked] = useState<PledgeAction | null>(null);
  const [text, setText] = useState('');
  const words = MAKE_UP_TEXTS[locale];
  const deedTitle = (action: PledgeAction, own?: string) => {
    const info = PLEDGE_DEED_INFO.find((d) => d.key === action);
    if (info) return locale === 'en' ? info.titleEn : info.titleAr;
    if (action === 'sadaqah') return own ? `${words.sadaqah}: ${own}` : words.sadaqah;
    return own ?? words.custom;
  };

  if (chosen) {
    return (
      <View style={styles.group}>
        <Text variant="heading">{words.title}</Text>
        <Notice icon={CircleCheck}>{deedTitle(chosen.action, chosen.text)}</Notice>
        {chosen.done ? (
          <Text variant="small" tone="link">
            {t('habitsTab.mend.doneLine')}
          </Text>
        ) : (
          <Button
            label={words.done}
            onPress={() => {
              setHeart((h) => markMakeUpDone(h, plan.id, on));
              toast(t('habitsTab.mend.doneToast'));
            }}
            block
          />
        )}
      </View>
    );
  }

  const actions: PledgeAction[] = [...PLEDGE_DEED_INFO.map((d) => d.key), 'sadaqah', 'custom'];
  const needsText = picked === 'custom' || picked === 'sadaqah';
  const ready = picked !== null && (picked !== 'custom' || text.trim().length > 0);
  return (
    <View style={styles.group}>
      <Text variant="heading">{words.title}</Text>
      <Text variant="small" tone="muted">
        {words.prompt}
      </Text>
      {actions.map((action) => {
        const hasEvidence = pledgeEvidence(action).length > 0;
        return (
          <View key={action} style={styles.deed}>
            <View style={styles.deedChoice}>
              <CheckRow radio title={deedTitle(action)} checked={picked === action} onPress={() => setPicked(action)} />
            </View>
            {hasEvidence ? (
              <IconButton icon={BookOpenText} label={`${t('habitsTab.mend.evidence')}: ${deedTitle(action)}`} tone="link" onPress={() => onEvidence(action)} />
            ) : (
              <View style={{ width: 48 }} />
            )}
          </View>
        );
      })}
      {needsText ? (
        <Field
          label={picked === 'custom' ? words.custom : t('habitsTab.mend.sadaqahWhat')}
          value={text}
          maxLength={140}
          onChangeText={setText}
        />
      ) : null}
      <Button
        label={t('habitsTab.mend.choose')}
        disabled={!ready}
        onPress={() => {
          if (!picked) return;
          setHeart((h) => chooseMakeUp(h, { planId: plan.id, on, date: today, action: picked, ...(text.trim() ? { text } : {}) }));
          toast(t('habitsTab.mend.chosenToast'));
        }}
        block
      />
    </View>
  );
}

/** «الدليل» of one deed: its public texts, read from the API. */
function DeedEvidenceSheet({ action, onClose }: { action: PledgeAction | null; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const ids = action ? [...pledgeEvidence(action)] : [];
  const evidence = useEvidence(ids, locale);
  return (
    <BottomSheet visible={action !== null} title={t('habitsTab.mend.evidence')} onClose={onClose}>
      <EvidenceList ids={ids} byId={evidence.data} loading={evidence.isLoading} error={evidence.isError} title="" size="heading" />
    </BottomSheet>
  );
}
