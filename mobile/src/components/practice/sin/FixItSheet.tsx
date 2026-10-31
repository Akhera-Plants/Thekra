/**
 * «خربانة؟ صلّحها» in one sheet, four short steps (redesign phase 3): (1) تب الآن with a short text from the after-fall
 * evidence and one tap that marks the day «وقعت ثم تبت»; (2) «أتبع السيئة الحسنة»: the minimum of an alternative habit
 * the user already keeps, otherwise a generic «حسنة الآن» mark on the day; (3) the trigger chips; (4) one small limit
 * for tomorrow (shown on tomorrow's «تخفَّف» screen). Steps 2–4 write onto today's check-in, so they wait for step 1.
 * LOCAL ONLY: everything stays in the program on this device (and its encrypted vault).
 */

import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import {
  alternativePlan,
  annotateCheckIn,
  checkIn,
  limitChoices,
  logForDay,
  resolveLimit,
  shortestTextId,
  updatePlan,
  type LimitRef,
  type SinProgram,
} from '@thekra/practice-core';
import { QuoteCard } from '@/components/QuoteCard';
import { pick, pickList, type CatalogHabit, type CatalogSinProgram, type SinProgramsCommon } from '@/lib/practice/catalog-types';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { QuoteDto } from '@/lib/types/api';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Text } from '@/ui';
import { TriggerChips } from './TriggerChips';

const makeStyles = (t: Theme) => ({
  root: { flex: 1, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  sheet: {
    maxHeight: '92%' as const,
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.panel,
    borderTopEndRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
  },
  content: { paddingHorizontal: GUTTER, paddingTop: space.lg, gap: space.lg },
  step: { gap: space.md },
  stepHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  done: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  limits: { gap: space.sm },
  limit: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  limitOn: { borderColor: t.colors.primary },
  limitText: { flex: 1 },
});

/** A limit's text in the screen's language: the program's own step, or the generic limit's translation. */
export function useLimitLabel(actions: readonly string[]): (ref: LimitRef) => string | null {
  const { t } = useTranslation();
  return useCallback(
    (ref: LimitRef) => {
      const resolved = resolveLimit(ref, actions);
      if (!resolved) return null;
      return resolved.kind === 'action' ? resolved.text : t(`sinProgram.limits.${resolved.key}`);
    },
    [actions, t],
  );
}

function Step({ n, title, muted, children }: { n: number; title: string; muted?: boolean; children?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={styles.stepNumber}>
          <Text variant="caption" tone="muted">
            {String(n)}
          </Text>
        </View>
        <Text variant="heading" tone={muted ? 'muted' : 'default'} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Done({ children }: { children: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.done} accessibilityLiveRegion="polite">
      <Icon icon={Check} size={16} tone="link" />
      <Text variant="small" tone="link">
        {children}
      </Text>
    </View>
  );
}

interface LimitPickerProps {
  choices: LimitRef[];
  selected: LimitRef | null;
  label: (ref: LimitRef) => string | null;
  onSelect: (ref: LimitRef | null) => void;
}

/** One limit; a second tap clears it. */
export function LimitPicker({ choices, selected, label, onSelect }: LimitPickerProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.limits} accessibilityRole="radiogroup">
      {choices.map((ref) => {
        const text = label(ref);
        if (!text) return null;
        const on = selected === ref;
        return (
          <Pressable
            key={ref}
            onPress={() => onSelect(on ? null : ref)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.limit, on && styles.limitOn, pressed && { opacity: 0.8 }]}
          >
            {on ? <Icon icon={Check} size={16} tone="link" /> : null}
            <Text variant="body" tone={on ? 'link' : 'default'} style={styles.limitText}>
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface FixItSheetProps {
  visible: boolean;
  onClose: () => void;
  program: SinProgram;
  entry: CatalogSinProgram;
  common: SinProgramsCommon;
  habits: readonly CatalogHabit[];
  evidenceById: Map<string, QuoteDto> | undefined;
  today: string;
}

export function FixItSheet({ visible, onClose, program, entry, common, habits, evidenceById, today }: FixItSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const locale = useUiLocale();
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const actions = pickList(entry.actionsAr, entry.actionsEn, locale);
  const limitLabel = useLimitLabel(actions);
  const day = program.checkIns.find((c) => c.date === today) ?? null;
  const fell = day !== null && day.value !== 'held';
  const texts = evidenceById ? [...evidenceById.values()] : [];
  const duaId = shortestTextId(common.afterFall.evidence ?? [], texts);
  const dua = duaId ? evidenceById?.get(duaId) : undefined;
  const alt = alternativePlan(plans, entry.alternatives ?? []);
  const altHabit = alt ? habitFor(alt.plan, habits) : undefined;
  const habitTitle = altHabit ? pick(altHabit, 'title', locale) : (alt?.plan.title ?? '');
  const habitDone = alt ? (alt.plan.log[today] ?? 0) >= alt.minimum : false;

  function edit(change: (p: SinProgram) => SinProgram) {
    setStore((s) => ({ ...s, programs: s.programs.map((p) => (p.sinSlug === program.sinSlug ? change(p) : p)) }));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
            <Text variant="title" accessibilityRole="header">
              {pick(common.afterFall, 'title', locale)}
            </Text>
            <Text variant="small" tone="muted">
              {t('sinProgram.fixit.lead')}
            </Text>

            <Step n={1} title={t('sinProgram.fixit.step1')}>
              {dua ? <QuoteCard quote={dua} shareable={false} /> : null}
              {day?.value === 'fell_repented' ? (
                <Done>{t('sinProgram.fixit.repented')}</Done>
              ) : (
                <Button label={t('sinProgram.fixit.repent')} onPress={() => edit((p) => checkIn(p, today, 'fell_repented'))} />
              )}
            </Step>

            <Step n={2} title={t('sinProgram.fixit.step2')} muted={!fell}>
              {!fell ? null : alt ? (
                habitDone ? (
                  <Done>{t('sinProgram.fixit.habitLogged', { habit: habitTitle })}</Done>
                ) : (
                  <Button
                    label={t('sinProgram.fixit.logHabit', { habit: habitTitle })}
                    variant="outline"
                    onPress={() => setStore((s) => updatePlan(s, alt.plan.id, (plan) => logForDay(plan, today, alt.minimum, today)))}
                  />
                )
              ) : day?.goodDeed ? (
                <Done>{t('sinProgram.fixit.goodDeedDone')}</Done>
              ) : (
                <>
                  <Button label={t('sinProgram.fixit.goodDeed')} variant="outline" onPress={() => edit((p) => annotateCheckIn(p, today, { goodDeed: true }))} />
                  <Text variant="small" tone="muted">
                    {t('sinProgram.fixit.goodDeedHint')}
                  </Text>
                </>
              )}
            </Step>

            <Step n={3} title={t('sinProgram.fixit.step3')} muted={!fell}>
              {fell ? (
                <TriggerChips showTitle={false} value={day.triggers ?? {}} onChange={(next) => edit((p) => annotateCheckIn(p, today, { triggers: next }))} />
              ) : null}
            </Step>

            <Step n={4} title={t('sinProgram.fixit.step4')} muted={!fell}>
              {fell ? (
                <LimitPicker
                  choices={limitChoices(actions.length, day.triggers)}
                  selected={day.nextLimit ?? null}
                  label={limitLabel}
                  onSelect={(ref) => edit((p) => annotateCheckIn(p, today, { nextLimit: ref }))}
                />
              ) : null}
              {fell && day.nextLimit ? (
                <Text variant="small" tone="muted">
                  {t('sinProgram.fixit.limitPicked')}
                </Text>
              ) : null}
            </Step>

            {!fell ? (
              <Text variant="small" tone="muted">
                {t('sinProgram.fixit.needCheckIn')}
              </Text>
            ) : null}
            <Button label={t('sinProgram.fixit.done')} variant="ghost" block onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
