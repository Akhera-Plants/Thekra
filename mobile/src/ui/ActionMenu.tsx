/**
 * The page's «⋯» menu (owner round 5, A-15; round-4 rule: destructive actions only behind «⋯» or in an edit sheet, with
 * a confirmation). A 48×48 «⋯» button for the native header's end (`headerRight`), opening a bottom sheet of
 * actions. A destructive item is red, and choosing it asks again inside the same sheet (its own words and a red
 * confirm beside «إلغاء»), so the confirmation works the same on iOS, Android and the web.
 *
 * Use: `<Stack.Screen options={{ headerRight: () => <ActionMenu label={t('common.moreActions')} items={[…]} /> }} />`.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ellipsis, type LucideIcon } from 'lucide-react-native';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { ButtonPair, IconButton, MIN_TARGET } from './Button';
import { Icon } from './Icon';
import { BottomSheet } from './Sheet';
import { Text } from './Text';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  /** Red, and confirmed before it runs. */
  destructive?: boolean;
  /** The confirmation's words (a destructive item without one asks with its own label). */
  confirm?: { title: string; message?: string; confirmLabel?: string };
  hint?: string;
}

const makeStyles = (t: Theme) => ({
  item: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: MIN_TARGET + 12,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemText: { flex: 1, minWidth: 0 },
  confirm: { gap: space.lg, paddingBottom: space.sm },
});

export function ActionMenu({ items, label }: { items: ActionMenuItem[]; label?: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<ActionMenuItem | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setAsking(null);
  }, []);
  const run = (item: ActionMenuItem) => {
    close();
    item.onPress();
  };
  const menuLabel = label ?? t('common.moreActions');
  return (
    <>
      <IconButton icon={Ellipsis} label={menuLabel} tone="default" onPress={() => setOpen(true)} />
      <BottomSheet visible={open} title={asking ? asking.confirm?.title ?? asking.label : menuLabel} onClose={close}>
        {asking ? (
          <View style={styles.confirm}>
            {asking.confirm?.message ? <Text variant="body">{asking.confirm.message}</Text> : null}
            <ButtonPair
              primary={{ label: asking.confirm?.confirmLabel ?? asking.label, onPress: () => run(asking), variant: 'danger' }}
              secondary={{ label: t('common.cancel'), onPress: () => setAsking(null), variant: 'outline' }}
            />
          </View>
        ) : (
          <View>
            {items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={() => (item.destructive ? setAsking(item) : run(item))}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.hint}
                android_ripple={{ color: colors.accent }}
                style={({ pressed }) => [styles.item, i === items.length - 1 && styles.itemLast, pressed && { opacity: 0.7 }]}
              >
                {item.icon ? <Icon icon={item.icon} size={20} tone={item.destructive ? 'destructive' : 'link'} /> : null}
                <View style={styles.itemText}>
                  <Text variant="body" tone={item.destructive ? 'destructive' : 'default'}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text variant="caption" tone="muted">
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </>
  );
}
