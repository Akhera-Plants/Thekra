/**
 * «أضف» from «ورد اليوم» (owner round 3, item 10; round 5, F-30 a): a bottom sheet in the kit's look with the choices
 * «عادة» (the setup stepper; the limit shows on the row BEFORE the tap: «3 من 3 · يمكنك إضافة عادة جديدة من 3 ديسمبر»),
 * «عمل دوري» (every periodic template of the catalog, with the plain note that these are reminders only; a people
 * template opens its list on «أهلي وناسي»; always open: periodic acts have their own limit), «تخفَّف» (generic words
 * only) and, while it is off, «الفرائض» (F-05 a: turns the section on). From «الدورية» it opens on the periodic list
 * (`periodic`). It rises from the bottom (still when the system asks to reduce motion); the backdrop, «إلغاء» and
 * Android back close it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BellRing, HeartHandshake, Landmark, Repeat, ShieldCheck, Sprout, type LucideIcon } from 'lucide-react-native';
import { fardEnabled, limitBlock, setFardTracking } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { dayMonth } from '@/lib/practice/calendar-grid';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useDateNames, useLimits } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { ListRow, Notice, Text, ButtonPair, toast } from '@/ui';

const RISE = 360;
const RISE_MS = 240;

interface Choice {
  key: string;
  icon: LucideIcon;
  titleKey: string;
  hintKey: string;
  href: Href;
}

const CHOICES: (Choice | 'periodic')[] = [
  { key: 'habit', icon: Sprout, titleKey: 'practice.hub.addHabit', hintKey: 'practice.hub.addHabitHint', href: '/practice/add' },
  'periodic',
  { key: 'program', icon: ShieldCheck, titleKey: 'practice.hub.addProgram', hintKey: 'practice.hub.addProgramHint', href: '/practice/sin-program' },
];

const makeStyles = (t: Theme) => ({
  root: { flex: 1, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  sheet: {
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.panel,
    borderTopEndRadius: radius.panel,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.colors.border,
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    gap: space.sm,
    maxHeight: '90%' as const,
  },
  scroll: { flexGrow: 0 },
});

export interface AddSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Only the periodic kinds (the «أعمال دورية» screen). */
  periodic?: boolean;
}

export function AddSheet({ visible, onClose, periodic }: AddSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const locale = useUiLocale();
  const templates = (usePracticeCatalog(locale).data?.habits ?? []).filter((h) => h.kind === 'periodic');
  const rise = useRef(new Animated.Value(RISE)).current;
  const [step, setStep] = useState<'menu' | 'periodic'>(periodic ? 'periodic' : 'menu');
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const names = useDateNames();
  const limits = useLimits();
  const allHabits = usePracticeCatalog(locale).data?.habits;
  // F-30 a: the habit limit in words before the tap, and when a new one fits by itself.
  const block = limitBlock(store, today(), 'sapling', { isPeriodicAct: (plan) => habitFor(plan, allHabits ?? [])?.kind === 'periodic' });
  const habitHint = block
    ? `${t('habitsTab.add.count', { n: Math.min(limits.sapling.count, limits.sapling.max), max: limits.sapling.max })} · ${
        block.unlocksOn ? t('practice.limits.why.habits_young', { date: dayMonth(block.unlocksOn, names) }) : t('practice.limits.why.habits_youngNoDate')
      }`
    : limits.sapling.count > 0
      ? t('habitsTab.add.count', { n: limits.sapling.count, max: limits.sapling.max })
      : t('practice.hub.addHabitHint');

  useEffect(() => {
    if (!visible) return;
    setStep(periodic ? 'periodic' : 'menu');
    let cancelled = false;
    rise.setValue(RISE);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) rise.setValue(0);
      else Animated.timing(rise, { toValue: 0, duration: RISE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [visible, rise, periodic]);

  function handleChoose(href: Href) {
    onClose();
    router.push(href);
  }

  // F-30 a: at the limit, «عادة» opens the limit sheet here, not the add steps with the sheet over their skeleton.
  const [limitOpen, setLimitOpen] = useState(false);
  function handleHabit(href: Href) {
    if (!block) return handleChoose(href);
    onClose();
    setLimitOpen(true);
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, transform: [{ translateY: rise }] }]}
            accessibilityViewIsModal
          >
            <Text variant="heading" accessibilityRole="header">
              {t(step === 'periodic' ? 'practice.hub.addPeriodicTitle' : 'practice.hub.addTitle')}
            </Text>
            {step === 'menu' ? (
              <View>
                {CHOICES.map((choice) =>
                  choice === 'periodic' ? (
                    <ListRow
                      key="periodic"
                      icon={Repeat}
                      title={t('practice.hub.addPeriodic')}
                      hint={t('practice.hub.addPeriodicHint')}
                      onPress={() => setStep('periodic')}
                    />
                  ) : (
                    <ListRow
                      key={choice.key}
                      icon={choice.icon}
                      title={t(choice.titleKey)}
                      hint={choice.key === 'habit' ? habitHint : t(choice.hintKey)}
                      onPress={() => (choice.key === 'habit' ? handleHabit(choice.href) : handleChoose(choice.href))}
                    />
                  ),
                )}
                {!fardEnabled(store) ? (
                  <ListRow
                    icon={Landmark}
                    title={t('habitsTab.add.fard')}
                    hint={t('habitsTab.add.fardHint')}
                    onPress={() => {
                      setStore((s) => setFardTracking(s, true));
                      toast(t('habitsTab.add.fardToast'));
                      onClose();
                    }}
                  />
                ) : null}
              </View>
            ) : (
              <>
                <Notice icon={BellRing}>{t('practice.hub.periodicNote')}</Notice>
                <ScrollView style={styles.scroll} nestedScrollEnabled>
                  {templates.map((habit) => (
                    <ListRow
                      key={habit.key}
                      icon={habit.people ? HeartHandshake : Repeat}
                      title={pick(habit, 'title', locale)}
                      hint={habit.people ? t('practice.hub.periodicPeople') : undefined}
                      onPress={() =>
                        handleChoose(
                          habit.people
                            ? { pathname: '/practice/kinship', params: { circle: habit.people, add: '1' } }
                            : { pathname: '/practice/add', params: { habit: habit.key } },
                        )
                      }
                    />
                  ))}
                </ScrollView>
              </>
            )}
            {/* One row: «رجوع» (inside the list step) beside «إلغاء», the same size (O-02). */}
            <ButtonPair
              primary={
                step !== 'menu' && !periodic
                  ? { label: t('practice.limits.back'), onPress: () => setStep('menu'), variant: 'outline' }
                  : { label: t('common.cancel'), onPress: onClose, variant: 'outline' }
              }
              secondary={step !== 'menu' && !periodic ? { label: t('common.cancel'), onPress: onClose, variant: 'ghost' } : null}
            />
          </Animated.View>
        </View>
      </Modal>
      <LimitSheet
        kind="sapling"
        visible={limitOpen}
        limits={limits}
        onClose={() => setLimitOpen(false)}
        onFreed={() => {
          setLimitOpen(false);
          router.push('/practice/add');
        }}
      />
    </>
  );
}
