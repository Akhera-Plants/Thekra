/**
 * The plan screen's today card, after the website's PlanCard: «المطلوب اليوم», «أتممتها» and «+1» as one ButtonPair,
 * a typed partial amount (whole numbers, practice-core `logDone`; partial amounts add up), and «صحّح السجل» (a week back, steppers for the day and the amount; practice-core `correctLog` on save).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Minus, PencilLine, Plus } from 'lucide-react-native';
import { addDays, type Plan } from '@thekra/practice-core';
import { parseLogAmount, shortDate } from '@/lib/practice/format';
import { fixLogStep, type PlanView } from '@/lib/practice/plan-view';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, ButtonPair, Card, ErrorText, Field, Icon, IconButton, NextStep, Text } from '@/ui';

/** «صحّح السجل» reaches this many days back (today included). */
const FIX_DAYS = 7;
const FIX_MAX = 1000;

const makeStyles = (t: Theme) => ({
  tight: { gap: space.xs },
  status: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  footer: { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: space.sm, marginTop: space.xs },
  stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  stepperValue: { flex: 1 },
  partialBlock: { gap: 6 },
  partial: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: space.sm },
  partialField: { flex: 1 },
  partialInput: { height: 44, writingDirection: 'ltr' as const, textAlign: 'center' as const },
  partialInvalid: { borderColor: t.colors.destructive },
  partialButton: { minWidth: 80 },
});

export interface TodayPanelProps {
  plan: Plan;
  view: PlanView;
  today: string;
  amountLabel: (n: number) => string;
  /** The word for one unit of the plan (the catalog's unit label), for the typed amount's label. */
  unitLabel: string;
  fixing: boolean;
  onLog: (amount: number) => void;
  onFixOpen: () => void;
  onFixSave: (date: string, amount: number) => void;
  onFixCancel: () => void;
}

/** «المطلوب اليوم», the log buttons, «سُجِّل · تراجع» and «صحّح السجل». */
export function TodayPanel({
  plan,
  view,
  today: d,
  amountLabel,
  unitLabel,
  fixing,
  onLog,
  onFixOpen,
  onFixSave,
  onFixCancel,
}: TodayPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const partial = view.done > 0 && !view.doneToday;
  return (
    <Card>
      <View style={styles.tight}>
        <Text variant="heading">{t('practice.plan.required', { amount: amountLabel(view.required) })}</Text>
        {view.done > 0 ? (
          <Text variant="small" tone="muted">
            {t('practice.plan.done', { amount: amountLabel(view.done) })}
          </Text>
        ) : null}
        {view.doneToday ? (
          <View style={styles.status}>
            <Icon icon={Check} size={16} tone="link" />
            <Text variant="small" weight="medium" tone="link">
              {t('practice.doneToday')}
            </Text>
          </View>
        ) : null}
        {view.inEbb ? (
          <Text variant="small" tone="muted">
            {t('practice.ebbActive')}
          </Text>
        ) : null}
      </View>

      {partial ? <NextStep title={t('practice.plan.fixItTitle')}>{t('practice.plan.fixItBody')}</NextStep> : null}

      {/* The day's one primary action and «+1» as one pair: side by side, the same size (O-02). «سُجّلت · تراجع» is a toast. */}
      <ButtonPair
        size="lg"
        primary={
          view.doneToday
            ? { label: t('practice.logPlusOne'), onPress: () => onLog(1), variant: 'outline' }
            : { label: t('practice.logRest'), icon: Check, onPress: () => onLog(view.remaining) }
        }
        secondary={view.doneToday ? null : { label: t('practice.logPlusOne'), onPress: () => onLog(1) }}
      />
      <PartialAmount unitLabel={unitLabel} onLog={onLog} />

      {fixing ? (
        <FixPanel plan={plan} today={d} amountLabel={amountLabel} onSave={onFixSave} onCancel={onFixCancel} />
      ) : (
        <View style={styles.footer}>
          <Button label={t('practice.plan.fixOpen')} icon={PencilLine} onPress={onFixOpen} variant="ghost" size="sm" />
        </View>
      )}
    </Card>
  );
}

/** «قدر عملته»: a typed whole amount, added to the day (Arabic-Indic digits accepted). */
function PartialAmount({ unitLabel, onLog }: { unitLabel: string; onLog: (amount: number) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const n = parseLogAmount(draft);
    if (n === null) {
      setInvalid(true);
      return;
    }
    onLog(n);
    setDraft('');
    setInvalid(false);
  }

  return (
    <View style={styles.partialBlock}>
      <Text variant="label">{t('practice.plan.partialLabel', { unit: unitLabel })}</Text>
      {/* The input and its «سجّل» on one line, the same height. */}
      <View style={styles.partial}>
        <Field
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setInvalid(false);
          }}
          onSubmitEditing={submit}
          placeholder={t('practice.logAmountPlaceholder')}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={4}
          accessibilityLabel={t('practice.plan.partialLabel', { unit: unitLabel })}
          containerStyle={styles.partialField}
          style={[styles.partialInput, invalid ? styles.partialInvalid : null]}
        />
        <Button label={t('practice.plan.logPartial')} onPress={submit} variant="outline" style={styles.partialButton} />
      </View>
      {invalid ? <ErrorText>{t('practice.logAmountInvalid')}</ErrorText> : null}
    </View>
  );
}

interface FixPanelProps {
  plan: Plan;
  today: string;
  amountLabel: (n: number) => string;
  onSave: (date: string, amount: number) => void;
  onCancel: () => void;
}

/** «صحّح السجل»: a forgotten or wrong day, up to a week back and never before the plan started. Zero clears it. */
export function FixPanel({ plan, today: d, amountLabel, onSave, onCancel }: FixPanelProps) {
  const { t } = useTranslation();
  const { rtl } = useTheme();
  const styles = useStyles(makeStyles);
  const [back, setBack] = useState(0);
  const [amount, setAmount] = useState(plan.log[d] ?? 0);
  const date = addDays(d, -back);
  const canGoBack = back < FIX_DAYS - 1 && addDays(d, -(back + 1)) >= plan.createdOn;
  const dayLabel = back === 0 ? t('practice.plan.fixToday') : back === 1 ? t('practice.plan.fixYesterday') : shortDate(date);

  function moveDay(step: number) {
    const next = back + step;
    setBack(next);
    setAmount(plan.log[addDays(d, -next)] ?? 0);
  }

  return (
    <Card tone="muted">
      <Text variant="small" tone="muted">
        {t('practice.plan.fixHint')}
      </Text>
      {/* Earlier days sit on the reading start (right in Arabic), later days towards the end. */}
      <View style={styles.stepper}>
        <IconButton icon={rtl ? ChevronRight : ChevronLeft} label={t('practice.plan.fixEarlier')} onPress={() => moveDay(1)} disabled={!canGoBack} tone="link" bordered />
        <Text variant="heading" align="center" style={styles.stepperValue} accessibilityLiveRegion="polite">
          {dayLabel}
        </Text>
        <IconButton icon={rtl ? ChevronLeft : ChevronRight} label={t('practice.plan.fixLater')} onPress={() => moveDay(-1)} disabled={back === 0} tone="link" bordered />
      </View>
      <View style={styles.stepper}>
        <IconButton icon={Minus} label={t('practice.plan.fixLess')} onPress={() => setAmount(fixLogStep(amount, plan.unit, -1, FIX_MAX))} disabled={amount <= 0} tone="link" bordered />
        <Text variant="heading" align="center" style={styles.stepperValue} accessibilityLiveRegion="polite">
          {amountLabel(amount)}
        </Text>
        <IconButton icon={Plus} label={t('practice.plan.fixMore')} onPress={() => setAmount(fixLogStep(amount, plan.unit, 1, FIX_MAX))} disabled={amount >= FIX_MAX} tone="link" bordered />
      </View>
      <ButtonPair
        primary={{ label: t('practice.plan.save'), onPress: () => onSave(date, amount) }}
        secondary={{ label: t('common.cancel'), onPress: onCancel }}
      />
    </Card>
  );
}
