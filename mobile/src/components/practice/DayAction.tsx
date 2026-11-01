/**
 * The action at the end of a row in «عاداتي» (owner, 2026-11-01: a clear button where only a chevron was), always
 * framed so it reads as a button:
 * - `log`: «سجّل», solid primary (asked for today, not done yet);
 * - `done`: «تمّ» with a check, primary outline on the soft tint (a tap undoes it where the row allows);
 * - `quiet`: «سجّل», a hairline outline in ink (not asked for today, still counts);
 * - `resume`: «استأنف», the same quiet outline.
 * 40 high (48 with the hit slop), the row itself still opens the plan.
 */

import React from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import type { HabitDayAction } from '@/lib/practice/my-habits';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Icon, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    minHeight: 40,
    minWidth: 76,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  log: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  done: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.link },
  quiet: { backgroundColor: 'transparent', borderColor: t.colors.border },
  pressed: { opacity: 0.85 },
  quietPressed: { backgroundColor: t.colors.accent, borderColor: t.colors.ring },
});

export interface DayActionProps {
  action: HabitDayAction;
  onPress: () => void;
  /** Names what the button acts on for screen readers («سجّل: صلاة الضحى»). */
  subject: string;
  /** What a tap on `done` does, for screen readers (a habit: takes today's log back). */
  doneHint?: string;
}

export function DayAction({ action, onPress, subject, doneHint }: DayActionProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const label = action === 'done' ? t('myHabits.done') : action === 'resume' ? t('practice.paused.resume') : t('myHabits.log');
  const style = action === 'log' ? styles.log : action === 'done' ? styles.done : styles.quiet;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: space.xs, right: space.xs }}
      android_ripple={{ color: action === 'log' ? colors.ring : colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${subject}`}
      accessibilityState={action === 'done' ? { checked: true } : undefined}
      accessibilityHint={action === 'done' ? doneHint : undefined}
      style={({ pressed }) => [styles.base, style, pressed && (action === 'log' ? styles.pressed : styles.quietPressed)]}
    >
      {action === 'done' ? <Icon icon={Check} size={16} tone="link" strokeWidth={2} /> : null}
      <Text variant="small" weight="medium" tone={action === 'log' ? 'inverse' : action === 'done' ? 'link' : 'default'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
