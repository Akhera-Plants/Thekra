/**
 * «استراتيجيات العادات» (redesign §4.5; owner round 3; round 5, F-12 a): a library to read, with ONE entry (in «المزيد»).
 * The strategies themselves appear in their moment («ابدأ صغيرًا» in «أضف», «اركب الموجة» in «لحظة مجاهدة», «اقضِ ما
 * فاتك» in «صلّحها», «حاسب نفسك» in المحاسبة), so there is no «ذكّرني بها» and no weekly reminder any more. Two tabs so the
 * page stays short (owner, 2026-11-03):
 * 1. «الاستراتيجيات» (first): practice-core `STRATEGIES` without «لا تفوّتها مرتين» (it appears the day after a missed
 *    habit, on its row), each an accordion row: one idea line, its example and «جرّبها» (the screen it maps to;
 *    «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds instead, never «تخفَّف»);
 * 2. «قبل أن تبدأ»: the educational cards.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { setHeartPrefs, type Strategy } from '@thekra/practice-core';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { listedStrategies, strategyTarget } from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Icon, PageHeader, Screen, Section, SegmentTabs, Text, type SegmentItem } from '@/ui';

type Tab = 'list' | 'cards';

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
  item: { borderBottomWidth: 1, borderBottomColor: t.colors.border },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 56, paddingVertical: space.md },
  headPressed: { opacity: 0.7 },
  headTitle: { flex: 1, minWidth: 0 },
  body: { gap: space.md, paddingBottom: space.lg },
});

export default function StrategiesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Tab>('list');
  const tabs: SegmentItem<Tab>[] = [
    { key: 'list', label: t('practice.strategies.listTitle') },
    { key: 'cards', label: t('practice.strategies.cardsTitle') },
  ];

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('practice.strategies.title')} lead={t('practice.strategies.lead')} />
      <SegmentTabs items={tabs} value={tab} onChange={setTab} />
      {tab === 'list' ? (
        <Section>
          <View style={styles.list}>
            {listedStrategies().map((strategy) => (
              <StrategyItem key={strategy.key} strategy={strategy} />
            ))}
          </View>
        </Section>
      ) : (
        <View style={styles.cards}>
          <HabitLoopCard />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </View>
      )}
    </Screen>
  );
}

/** One strategy as an accordion row (owner, 2026-11-03: organise, don't stack text): opened, the idea, its example, «جرّبها». */
function StrategyItem({ strategy }: { strategy: Strategy }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const target = strategyTarget(strategy.action, strategy.key);
  const [open, setOpen] = useState(false);
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
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}
      >
        <Text variant="heading" style={styles.headTitle}>
          {title}
        </Text>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} tone="muted" />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text variant="body">{t(`practice.strategies.items.${strategy.key}.idea`)}</Text>
          <Text variant="small" tone="muted">
            {`${t('practice.strategies.example')}: ${t(`practice.strategies.items.${strategy.key}.example`)}`}
          </Text>
          <Button
            label={target.kind === 'deeds' && deedsOpen ? t('practice.strategies.hideDeeds') : t('practice.strategies.try')}
            icon={target.kind === 'deeds' && deedsOpen ? ChevronUp : undefined}
            arrow={!(target.kind === 'deeds' && deedsOpen)}
            onPress={handleTry}
            variant={target.kind === 'deeds' && deedsOpen ? 'outline' : 'solid'}
            size="sm"
          />
          {target.kind === 'deeds' && deedsOpen ? (
            <View style={{ gap: space.sm }}>
              <Text variant="small" tone="muted">
                {t('practice.strategies.deedsLead')}
              </Text>
              <EasyDeeds />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
