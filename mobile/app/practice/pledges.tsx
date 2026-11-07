/**
 * «التزام شخصي» (opt-in from Settings ← «المحاسبة»): every habit in one list, each with its own make-up deed («إن فاتتني
 * يومين: …») or a bordered «اختر عملًا». A row opens the habit's pledge sheet (components/practice/PledgeSheet), where
 * the deed is chosen, saved or removed; nothing is deleted from the list itself. Device-local (practice-store `heart`).
 * Never called a penalty.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleCheck } from 'lucide-react-native';
import type { Plan } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { pledgeOfPlan } from '@/lib/practice/pledges';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { pledgeWords, planTitleOf } from '@/components/practice/hub/HeartCards';
import { PledgeSheet, usePledgeDone } from '@/components/practice/PledgeSheet';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, ForwardChevron, Notice, PageHeader, Screen, Text } from '@/ui';

type T = (key: string, opts?: Record<string, unknown>) => string;

const makeStyles = (t: Theme) => ({
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  text: { flex: 1, gap: space.xs, alignItems: 'flex-start' as const },
  done: { paddingTop: space.xs },
});

export default function PledgesScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const plans = usePracticeStore((s) => s.store.plans);
  const heart = usePracticeStore((s) => s.heart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [open, setOpen] = useState<Plan | null>(null);
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  const [done, showDone] = usePledgeDone();

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('practice.notifyPrefs.pledges')} lead={t('practice.notifyPrefs.pledgesHint')} />
      {plans.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('practice.notifyPrefs.noHabits')}
        </Text>
      ) : (
        <View style={styles.list}>
          {plans.map((plan) => {
            const title = planTitleOf(plan, habits, locale);
            const pledge = pledgeOfPlan(heart, plan.id);
            return (
              <Pressable
                key={plan.id}
                onPress={() => setOpen(plan)}
                android_ripple={{ color: colors.accent }}
                accessibilityRole="button"
                accessibilityLabel={pledge ? `${title}, ${pledgeWords(pledge, t as unknown as T, locale)}` : title}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.text}>
                  <Text variant="body" weight="medium">
                    {title}
                  </Text>
                  {pledge ? (
                    <Text variant="small" tone="muted">
                      {t('practice.notifyPrefs.pledgeIfShort', { deed: pledgeWords(pledge, t as unknown as T, locale) })}
                    </Text>
                  ) : (
                    <Button label={t('practice.notifyPrefs.pledgeChoose')} onPress={() => setOpen(plan)} variant="outline" size="sm" />
                  )}
                  {done && lastPlanId === plan.id ? (
                    <View style={styles.done} accessibilityLiveRegion="polite">
                      <Notice icon={CircleCheck}>{done}</Notice>
                    </View>
                  ) : null}
                </View>
                {pledge ? <ForwardChevron size={18} tone="muted" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <PledgeSheet
        visible={open !== null}
        planId={open?.id ?? null}
        habitTitle={open ? planTitleOf(open, habits, locale) : ''}
        onClose={() => setOpen(null)}
        onDone={(message) => {
          setLastPlanId(open?.id ?? null);
          showDone(message);
        }}
      />
    </Screen>
  );
}
