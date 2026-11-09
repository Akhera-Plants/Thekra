/**
 * Page tabs with an underline (owner round 6, §2 / §3: the reference's tab style, our type and colours): a row of
 * labels over one hairline; the current tab in the foreground ink with a 2px primary bar under it, the others muted.
 * Used for the top tabs of «عاداتي» and of the habit page. The row scrolls sideways only when the labels do not fit
 * (English, large text), and the current tab is scrolled into view. Each tab is a 44px target with role `tab`.
 * The pill `SegmentTabs` stays for secondary choices inside a tab (اليوم / الأسبوع, أسبوع · شهر · حصيلة).
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { MIN_TARGET } from './Button';
import { Text } from './Text';
import type { SegmentItem } from './controls';

const makeStyles = (t: Theme) => ({
  scroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  row: { flexDirection: 'row' as const, flexGrow: 1, gap: space.md },
  tab: { minHeight: MIN_TARGET + 4, justifyContent: 'center' as const, paddingHorizontal: 2 },
  bar: { position: 'absolute' as const, start: 0, end: 0, bottom: -1, height: 2, borderRadius: 1 },
  label: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
});

export function UnderlineTabs<K extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
}: {
  items: SegmentItem<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const sizes = useRef({ view: 0, content: 0 });

  // Only a row that does not fit scrolls, and then only to bring the current tab into view.
  useEffect(() => {
    const x = offsets.current.get(value);
    if (x !== undefined && sizes.current.content > sizes.current.view + 1) scroll.current?.scrollTo({ x: Math.max(0, x - space.xl), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={{ flexGrow: 1 }}
      onLayout={(e) => (sizes.current.view = e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => (sizes.current.content = w)}
    >
      <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
        {items.map((item) => {
          const active = item.key === value;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              onLayout={(e: LayoutChangeEvent) => offsets.current.set(item.key, e.nativeEvent.layout.x)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.label}>
                <Text variant="body" weight={active ? 'medium' : 'regular'} tone={active ? 'default' : 'muted'} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.count !== undefined ? (
                  <Text variant="caption" tone="muted">
                    {String(item.count)}
                  </Text>
                ) : null}
              </View>
              {active ? <View style={[styles.bar, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
