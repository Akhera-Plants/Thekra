/**
 * «استراتيجيات العادات» (redesign §4.5; owner round 3, items 13, 14, 17 and 18), reached from its card at the top of
 * «عاداتي» and from the side menu. Two tabs so the page stays short (owner, 2026-11-03):
 * 1. «الاستراتيجيات» (first): one line on «ذكّرني بها» (one reminder a week, its day and time in Settings ›
 *    «الإشعارات», reached by «وقت التذكير» once one is chosen), then the strategies (practice-core `STRATEGIES` without
 *    «لا تفوّتها مرتين», which appears in context the day after a habit is missed, on its row): one idea line, «جرّبها»
 *    (the screen it maps to; «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds instead, never
 *    «تخفَّف»), its example and the «ذكّرني بها» switch, each strategy an accordion row (a bell while it is on);
 * 2. «قبل أن تبدأ»: the educational cards; «حلقة العادة» leads to «ابنِ حلقة عادتك الخاصة» (practice/loops).
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BellRing, ChevronDown, ChevronUp, Clock, Repeat } from 'lucide-react-native';
import { setHeartPrefs, toggleStrategy, type Strategy } from '@thekra/practice-core';
import { ensurePermission } from '@/lib/practice/notifications';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { listedStrategies, strategyTarget } from '@/lib/practice/strategies';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ConsistencyCard, HabitLoopCard, SinStepsCard } from '@/components/practice/hub/KnowledgeCards';
import { EasyDeeds } from '@/components/practice/mujahada/EasyDeeds';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Notice, PageHeader, Screen, Section, SegmentTabs, SwitchRow, Text, type SegmentItem } from '@/ui';

type Tab = 'list' | 'cards';

const openReminderTime = () => router.push('/settings/notifications');

const makeStyles = (t: Theme) => ({
  cards: { gap: space.md },
  remind: { gap: space.sm },
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
          <View style={styles.remind}>
            <Notice icon={BellRing}>{t('practice.strategies.remindHint')}</Notice>
            {chosen.length > 0 ? (
              <Button label={t('practice.strategies.time')} icon={Clock} variant="outline" size="sm" onPress={openReminderTime} />
            ) : null}
          </View>
          {denied ? <Notice tone="destructive">{t('practice.permissionDenied')}</Notice> : null}
          <View style={styles.list}>
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
      ) : (
        <View style={styles.cards}>
          <HabitLoopCard />
          <Button label={t('loops.habit.pageTitle')} icon={Repeat} variant="outline" arrow onPress={() => router.push('/practice/loops')} />
          <SinStepsCard withSource />
          <ConsistencyCard />
        </View>
      )}
    </Screen>
  );
}

/**
 * One strategy as an accordion row (owner, 2026-11-03: organise, don't stack text): the title, a bell while
 * «ذكّرني بها» is on, and a chevron; opened, the idea, its example, «جرّبها» and the «ذكّرني بها» switch.
 */
function StrategyItem({ strategy, reminding, onRemind }: { strategy: Strategy; reminding: boolean; onRemind: (on: boolean) => void }) {
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
        accessibilityLabel={reminding ? `${title}, ${t('practice.strategies.remind')}` : title}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}
      >
        <Text variant="heading" style={styles.headTitle}>
          {title}
        </Text>
        {reminding ? <Icon icon={BellRing} size={17} tone="link" /> : null}
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
          <SwitchRow label={t('practice.strategies.remind')} value={reminding} onValueChange={onRemind} />
        </View>
      ) : null}
    </View>
  );
}
