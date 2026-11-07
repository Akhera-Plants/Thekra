/**
 * Periodic acts as hairline rows (kit `ListRow`): the name, a relative's relation (or «صلة الرحم») under it, and when
 * it is next due on the end. A relative opens the kinship page (its add and edit live there); a habit opens its plan.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { HeartHandshake, Repeat } from 'lucide-react-native';
import type { PeriodicRowModel } from '@/lib/practice/use-habits-hub';
import { useStyles, type Theme } from '@/theme';
import { ListRow } from '@/ui';

const makeStyles = (_t: Theme) => ({
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
});

function open(row: PeriodicRowModel) {
  if (row.act.kind === 'relative') router.push('/practice/kinship');
  else router.push(`/practice/plan/${row.act.id}`);
}

export function PeriodicRows({ rows }: { rows: readonly PeriodicRowModel[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          icon={row.act.kind === 'relative' ? HeartHandshake : Repeat}
          title={row.title}
          hint={row.note || undefined}
          value={row.when}
          onPress={() => open(row)}
        />
      ))}
    </View>
  );
}
