/**
 * The one-time «أضف ورد اليوم إلى شاشتك» line (owner round 5, F-24 a; rule in ./intro.ts). For «ورد اليوم»: place
 * `<WidgetIntroLine />` once in the tab's content (it renders nothing unless the rule says so), or read
 * `useWidgetIntro()` to draw it yourself. Android only. «أضفها» asks the launcher to pin the wird widget
 * (react-native-android-widget `requestPinWidget`); a launcher that cannot pin leaves the how-to line. Shown once: the
 * first time it appears it is marked seen, and «لاحقًا» closes it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react-native';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Text, toast } from '@/ui';
import { loggedDays, shouldShowWidgetIntro, WIDGET_INTRO_KEY } from './intro';

const WIRD_WIDGET = 'WirdWidget';

async function wirdWidgetPlaced(): Promise<boolean> {
  try {
    const { getWidgetInfo } = await import('react-native-android-widget');
    return (await getWidgetInfo(WIRD_WIDGET)).length > 0;
  } catch {
    return false;
  }
}

/** `visible` once the rule allows it (then it is marked seen); `add` asks to pin; `dismiss` closes it. */
export function useWidgetIntro(): { visible: boolean; add: () => Promise<boolean>; dismiss: () => void } {
  const days = usePracticeStore((s) => (s.hydrated ? loggedDays(s.store) : 0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || days === 0) return;
    let active = true;
    void (async () => {
      let seen = false;
      try {
        seen = (await AsyncStorage.getItem(WIDGET_INTRO_KEY)) !== null;
      } catch {
        seen = true; // Storage unavailable: never nag.
      }
      const placed = seen ? false : await wirdWidgetPlaced();
      if (!active || !shouldShowWidgetIntro({ os: Platform.OS, days, seen, placed })) return;
      setVisible(true);
      void AsyncStorage.setItem(WIDGET_INTRO_KEY, new Date().toISOString()).catch(() => undefined);
    })();
    return () => {
      active = false;
    };
  }, [days]);

  const dismiss = useCallback(() => setVisible(false), []);
  const add = useCallback(async () => {
    try {
      const { requestPinWidget } = await import('react-native-android-widget');
      return await requestPinWidget({ widgetName: WIRD_WIDGET });
    } catch {
      return false;
    }
  }, []);
  return { visible, add, dismiss };
}

const makeStyles = (t: Theme) => ({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  title: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row' as const, gap: space.sm, flexWrap: 'wrap' as const },
});

export function WidgetIntroLine() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { visible, add, dismiss } = useWidgetIntro();
  const [pinFailed, setPinFailed] = useState(false);
  if (!visible) return null;

  async function handleAdd() {
    const ok = await add();
    if (ok) {
      dismiss();
      toast(t('widget.intro.asked'));
    } else setPinFailed(true);
  }

  return (
    <View style={styles.card} accessibilityLabel={t('widget.intro.title')}>
      <View style={styles.head}>
        <Icon icon={LayoutGrid} size={20} tone="link" />
        <Text variant="body" weight="medium" style={styles.title}>
          {t('widget.intro.title')}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {t('widget.intro.how')}
      </Text>
      <View style={styles.actions}>
        {pinFailed ? null : <Button label={t('widget.intro.add')} size="sm" onPress={() => void handleAdd()} />}
        <Button label={t('widget.intro.later')} size="sm" variant="ghost" onPress={dismiss} />
      </View>
    </View>
  );
}
