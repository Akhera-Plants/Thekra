/**
 * «إنجازات الصحبة خلال آخر 7 أيام» (owner round 7, D4: «زبّط شكل الكاليندر … بدي ياه ملفت»): a tinted panel with the
 * seven days as columns (today's column stands out), one row per member and a filled green check on a day they
 * logged something (and share it). Nothing on the other days: there is no "missed" mark, no count and no ordering by
 * activity; members keep the order they joined in.
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Lock, Sprout } from 'lucide-react-native';
import { weekday } from '@thekra/practice-core';
import type { CircleMember } from '@/lib/types/circles';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Icon, Text } from '@/ui';

const NAME_WIDTH = 92;
const MARK = 24;

const makeStyles = (t: Theme) => ({
  panel: {
    borderRadius: radius.card + 4,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.primarySoft,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    gap: space.md,
  },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingHorizontal: space.xs },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primary,
  },
  headText: { flex: 1, minWidth: 0 },
  grid: { borderRadius: radius.card, backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' as const },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 48, borderTopWidth: 1, borderTopColor: t.colors.border },
  dayRow: { flexDirection: 'row' as const, alignItems: 'stretch' as const, paddingVertical: space.sm },
  name: { width: NAME_WIDTH, paddingStart: space.md, paddingEnd: space.xs },
  cell: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 40 },
  todayCell: { backgroundColor: t.colors.muted },
  dayHead: { flex: 1, alignItems: 'center' as const, gap: 2, paddingVertical: 2, marginHorizontal: 2, borderRadius: radius.control },
  dayHeadToday: { backgroundColor: t.colors.primary },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primary,
  },
  blank: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: t.colors.border },
  note: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingHorizontal: space.xs },
});

function DayHeads({ days, today }: { days: readonly string[]; today: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.dayRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.name} />
      {days.map((day) => {
        const isToday = day === today;
        return (
          <View key={day} style={[styles.dayHead, isToday && styles.dayHeadToday]}>
            <Text variant="caption" tone={isToday ? 'inverse' : 'muted'} numberOfLines={1}>
              {t(`practice.hub.weekdayShort.${weekday(day)}`)}
            </Text>
            <Text variant="small" weight="medium" tone={isToday ? 'inverse' : 'default'}>
              {String(Number(day.slice(8, 10)))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const MemberRow = memo(function MemberRow({ member, days, today }: { member: CircleMember; days: readonly string[]; today: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const name = member.isMe ? t('circles.you') : member.displayName;
  const present = new Set(member.presentDays);
  return (
    <View style={styles.row}>
      <Text variant="small" weight={member.isMe ? 'semibold' : 'regular'} numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      {days.map((day) => {
        const isPresent = present.has(day);
        const label = t(isPresent ? 'circles.presentA11y' : 'circles.blankA11y', {
          name,
          day: t(`practice.weekdays.${weekday(day)}`),
        });
        return (
          <View key={day} style={[styles.cell, day === today && styles.todayCell]} accessible accessibilityLabel={label}>
            {isPresent ? (
              <View style={styles.mark}>
                <Icon icon={Check} size={15} color={colors.primaryForeground} strokeWidth={2.6} />
              </View>
            ) : (
              <View style={styles.blank} />
            )}
          </View>
        );
      })}
    </View>
  );
});

export function WeekMarks({
  days,
  members,
  sharing,
}: {
  days: readonly string[];
  members: readonly CircleMember[];
  /** Whether my own marks show; a quiet line says how to turn them on when they do not. */
  sharing: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const today = days[days.length - 1] ?? '';
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Icon icon={Sprout} size={22} color={colors.primaryForeground} />
        </View>
        <View style={styles.headText}>
          <Text variant="heading" accessibilityRole="header">
            {t('circles.weekTitle')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('circles.weekLead')}
          </Text>
        </View>
      </View>
      <View style={styles.grid}>
        <DayHeads days={days} today={today} />
        {members.map((member) => (
          <MemberRow key={member.memberId} member={member} days={days} today={today} />
        ))}
      </View>
      {sharing ? null : (
        <View style={styles.note}>
          <Icon icon={Lock} size={14} tone="muted" />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {t('circles.notSharingHint')}
          </Text>
        </View>
      )}
    </View>
  );
}
