/**
 * «أضف» from «ورد اليوم»: a bottom sheet in the kit's look (card fill, hairline, panel radius on top; no grab handle,
 * as it does not drag) with three choices: a habit (the setup wizard), a relative (the kinship page with its add form
 * open), «تخفَّف» (generic words only). From «أعمال دورية» it offers the two periodic kinds (`periodic`): a relative,
 * or a habit (whose days are chosen in the wizard). It rises from the bottom (still when the system asks to reduce
 * motion); the backdrop, «إلغاء» and Android back close it.
 */

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, ShieldCheck, Sprout, type LucideIcon } from 'lucide-react-native';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { Button, ListRow, Text } from '@/ui';

const RISE = 360;
const RISE_MS = 240;

interface Choice {
  key: string;
  icon: LucideIcon;
  titleKey: string;
  hintKey: string;
  href: Href;
}

const CHOICES: Choice[] = [
  { key: 'habit', icon: Sprout, titleKey: 'practice.hub.addHabit', hintKey: 'practice.noPlansHint', href: '/practice/add' },
  {
    key: 'relative',
    icon: HeartHandshake,
    titleKey: 'practice.hub.addRelative',
    hintKey: 'practice.hub.addRelativeHint',
    href: { pathname: '/practice/kinship', params: { add: '1' } },
  },
  { key: 'program', icon: ShieldCheck, titleKey: 'practice.hub.addProgram', hintKey: 'practice.hub.addProgramHint', href: '/practice/sin-program' },
];

const PERIODIC_CHOICES: Choice[] = [
  CHOICES[1]!,
  { key: 'habit', icon: Sprout, titleKey: 'practice.periodic.addHabit', hintKey: 'practice.periodic.addHabitHint', href: '/practice/add' },
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
  },
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
  const rise = useRef(new Animated.Value(RISE)).current;

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, rise]);

  function handleChoose(href: Href) {
    onClose();
    router.push(href);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg, transform: [{ translateY: rise }] }]}
          accessibilityViewIsModal
        >
          <Text variant="heading" accessibilityRole="header">
            {t(periodic ? 'practice.periodic.add' : 'practice.hub.addTitle')}
          </Text>
          <View>
            {(periodic ? PERIODIC_CHOICES : CHOICES).map((choice) => (
              <ListRow
                key={choice.key}
                icon={choice.icon}
                title={t(choice.titleKey)}
                hint={t(choice.hintKey)}
                onPress={() => handleChoose(choice.href)}
              />
            ))}
          </View>
          <Button label={t('common.cancel')} onPress={onClose} variant="ghost" block />
        </Animated.View>
      </View>
    </Modal>
  );
}
