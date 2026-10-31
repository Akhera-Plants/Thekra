/**
 * «استراتيجيات العادات» (redesign §4.5), reached from «سجلّي»: the educational cards first (the sin progression with its
 * source line, only here), then the fourteen strategies (practice-core `STRATEGIES`): one idea line, one example,
 * «جرّبها» (the screen it maps to) and «ذكّرني بها» (opt-in; at most one local notification a week, practice-core
 * `notificationPlan` kind `strategy`). Turning a reminder on asks for the notification permission first.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setHeartPrefs, STRATEGIES, toggleStrategy, type Strategy } from '@thekra/practice-core';
import { ensurePermission } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { strategyTarget } from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Notice, PageHeader, Screen, Section, SwitchRow, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  item: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

export default function StrategiesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const chosen = usePracticeStore((s) => s.prefs.strategies);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [denied, setDenied] = useState(false);

  async function handleRemind(key: string, on: boolean) {
    setDenied(false);
    if (on && !(await ensurePermission(t('practice.notify.channelName')))) {
      setDenied(true);
      return;
    }
    setPrefs((p) => ({ ...p, strategies: toggleStrategy(p.strategies, key) }));
  }

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('practice.strategies.title')} lead={t('practice.strategies.lead')} />
      <Section title={t('practice.strategies.cardsTitle')}>
        <View style={styles.cards}>
          <HabitLoopCard />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </View>
      </Section>
      <Section title={t('practice.strategies.title')}>
        <Text variant="small" tone="muted">
          {t('practice.strategies.remindHint')}
        </Text>
        {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
        <View>
          {STRATEGIES.map((strategy) => (
            <StrategyItem
              key={strategy.key}
              strategy={strategy}
              reminding={chosen.includes(strategy.key)}
              onRemind={(on) => void handleRemind(strategy.key, on)}
            />
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function StrategyItem({ strategy, reminding, onRemind }: { strategy: Strategy; reminding: boolean; onRemind: (on: boolean) => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const target = strategyTarget(strategy.action);

  function handleTry() {
    if (target.heart) setHeart((h) => setHeartPrefs(h, target.heart ?? {}));
    router.push(target.href);
  }

  return (
    <View style={styles.item}>
      <Text variant="heading" accessibilityRole="header">
        {locale === 'en' ? strategy.titleEn : strategy.titleAr}
      </Text>
      <Text variant="body">{t(`practice.strategies.items.${strategy.key}.idea`)}</Text>
      <Text variant="small" tone="muted">
        {t(`practice.strategies.items.${strategy.key}.example`)}
      </Text>
      <Button label={t('practice.strategies.try')} variant="outline" arrow onPress={handleTry} />
      <SwitchRow label={t('practice.strategies.remind')} value={reminding} onValueChange={onRemind} />
    </View>
  );
}
