/**
 * The circle's last 7 days: one row per member, a full dot on a day they logged something (and share it), and nothing
 * otherwise. There is no "missed" mark, no count and no ordering by activity: members keep the order they joined in.
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weekday } from '@thekra/practice-core';
import { PresenceDot } from '@/components/practice/hub/PresenceDot';
import type { CircleMember } from '@/lib/types/circles';
import { space, useStyles, type Theme } from '@/theme';
import { Text } from '@/ui';

const NAME_WIDTH = 104;

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  head: { minHeight: 40 },
  name: { width: NAME_WIDTH, paddingEnd: space.sm },
  cell: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 32 },
});

function DayHeads({ days }: { days: readonly string[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, styles.head]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.name} />
      {days.map((day) => (
        <View key={day} style={styles.cell}>
          <Text variant="caption" tone="muted">
            {t(`practice.hub.weekdayShort.${weekday(day)}`)}
          </Text>
          <Text variant="caption" tone="muted">
            {String(Number(day.slice(8, 10)))}
          </Text>
        </View>
      ))}
    </View>
  );
}

const MemberRow = memo(function MemberRow({ member, days }: { member: CircleMember; days: readonly string[] }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const name = member.isMe ? t('circles.you') : member.displayName;
  const present = new Set(member.presentDays);
  return (
    <View style={styles.row}>
      <Text variant="small" weight={member.isMe ? 'medium' : 'regular'} numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      {days.map((day) => {
        const isPresent = present.has(day);
        const label = t(isPresent ? 'circles.presentA11y' : 'circles.blankA11y', {
          name,
          day: t(`practice.weekdays.${weekday(day)}`),
        });
        return (
          <View key={day} style={styles.cell} accessible accessibilityLabel={label}>
            <PresenceDot level={isPresent ? 'full' : undefined} />
          </View>
        );
      })}
    </View>
  );
});

export function WeekMarks({ days, members }: { days: readonly string[]; members: readonly CircleMember[] }) {
  return (
    <View>
      <DayHeads days={days} />
      {members.map((member) => (
        <MemberRow key={member.memberId} member={member} days={days} />
      ))}
    </View>
  );
}
