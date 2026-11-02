/**
 * «استراتيجيات العادات» (redesign §4.5; owner round 3, items 13, 14, 17 and 18), reached from the side menu:
 * 1. «قبل أن تبدأ»: the educational cards; «حلقة العادة» leads to «ابنِ حلقة عادتك الخاصة» (practice/loops);
 * 2. the strategies (practice-core `STRATEGIES` without «لا تفوّتها مرتين», which appears in context the day after a
 *    habit is missed, on its row): one general idea line, then «جرّبها» (the screen it maps to; «أتبِع السيئةَ الحسنة»
 *    opens a short list of easy, high-reward good deeds instead, never «تخفَّف») and «مثال» (a sheet with the example),
 *    and «ذكّرني بها» (opt-in; at most one local notification a week). An ornament divides the sections.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronUp, Lightbulb, Repeat } from 'lucide-react-native';
import { setHeartPrefs, toggleStrategy, type Strategy } from '@thekra/practice-core';
import { ensurePermission } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { listedStrategies, strategyTarget } from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { BottomSheet } from '@/components/practice/mujahada/Sheet';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Notice, Ornament, PageHeader, Screen, Section, SwitchRow, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  item: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
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
          <Button label={t('loops.habit.pageTitle')} icon={Repeat} variant="outline" arrow onPress={() => router.push('/practice/loops')} />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </View>
      </Section>
      <Ornament />
      <Section title={t('practice.strategies.listTitle')}>
        <Text variant="small" tone="muted">
          {t('practice.strategies.remindHint')}
        </Text>
        {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
        <View>
          {listedStrategies().map((strategy) => (
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
  const target = strategyTarget(strategy.action, strategy.key);
  const [example, setExample] = useState(false);
  const [deedsOpen, setDeedsOpen] = useState(false);
  const title = locale === 'en' ? strategy.titleEn : strategy.titleAr;

  function handleTry() {
    if (target.kind === 'deeds') {
      setDeedsOpen((o) => !o);
      return;
    }
    if (target.heart) setHeart((h) => setHeartPrefs(h, target.heart ?? {}));
    router.push(target.href);
  }

  return (
    <View style={styles.item}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body">{t(`practice.strategies.items.${strategy.key}.idea`)}</Text>
      <View style={styles.actions}>
        <Button
          label={target.kind === 'deeds' && deedsOpen ? t('practice.strategies.hideDeeds') : t('practice.strategies.try')}
          icon={target.kind === 'deeds' && deedsOpen ? ChevronUp : undefined}
          arrow={!(target.kind === 'deeds' && deedsOpen)}
          onPress={handleTry}
          compact
        />
        <Button label={t('practice.strategies.example')} icon={Lightbulb} variant="outline" onPress={() => setExample(true)} compact />
      </View>
      {target.kind === 'deeds' && deedsOpen ? (
        <View style={{ gap: space.sm }}>
          <Text variant="small" tone="muted">
            {t('practice.strategies.deedsLead')}
          </Text>
          <EasyDeeds />
        </View>
      ) : null}
      <SwitchRow label={t('practice.strategies.remind')} value={reminding} onValueChange={onRemind} />
      <BottomSheet visible={example} title={`${t('practice.strategies.example')}: ${title}`} onClose={() => setExample(false)}>
        <Text variant="body">{t(`practice.strategies.items.${strategy.key}.example`)}</Text>
        <Button label={t('common.close')} onPress={() => setExample(false)} variant="outline" block />
      </BottomSheet>
    </View>
  );
}
