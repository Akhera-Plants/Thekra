/**
 * The action at the end of a row in «عاداتي» (owner, 2026-11-01: a clear button where only a chevron was), always
 * framed so it reads as a button:
 * - `log`: «سجّل», a primary outline (asked for today, not done yet; owner round 5, A-08: a row action is never solid,
 *   so the page keeps one solid action);
 * - `done`: «تمّ» with a check, primary outline on the soft tint (a tap undoes it where the row allows);
 * - `quiet`: «سجّل», a hairline outline in ink (not asked for today, still counts);
 * - `resume`: «استأنف», the same quiet outline.
 * 44 high (the kit's `sm` size), the row itself still opens the plan.
 */

import React from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import type { HabitDayAction } from '@/lib/practice/my-habits';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Icon, Text, MIN_TARGET } from '@/ui';

const makeStyles = (t: Theme) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    minHeight: MIN_TARGET,
    minWidth: 76,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  log: { backgroundColor: t.colors.card, borderColor: t.colors.link },
  done: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.link },
  quiet: { backgroundColor: 'transparent', borderColor: t.colors.controlBorder },
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
      hitSlop={{ left: space.xs, right: space.xs }}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${subject}`}
      accessibilityState={action === 'done' ? { checked: true } : undefined}
      accessibilityHint={action === 'done' ? doneHint : undefined}
      style={({ pressed }) => [styles.base, style, pressed && styles.quietPressed]}
    >
      {action === 'done' ? <Icon icon={Check} size={16} tone="link" strokeWidth={2} /> : null}
      <Text variant="small" weight="medium" tone={action === 'quiet' || action === 'resume' ? 'default' : 'link'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
