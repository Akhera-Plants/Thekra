/**
 * The hadith grade as the website's seal (frontend GradeBadge): a small full-radius pill in the grade colour with the
 * grade word only — no check mark (owner round 7, B3) — never colour alone.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, useStyles, useTheme, type Palette } from '@/theme';
import { Text } from '@/ui/Text';
import { HadithGrade } from '@/lib/types/enums';
import type { HadithGrade as HadithGradeType } from '@/lib/types/enums';

const SEAL: Record<HadithGradeType, { bg: keyof Palette; fg: keyof Palette }> = {
  [HadithGrade.SAHIH]: { bg: 'gradeSahih', fg: 'gradeSahihForeground' },
  [HadithGrade.HASAN]: { bg: 'gradeHasan', fg: 'gradeHasanForeground' },
  [HadithGrade.DAIF]: { bg: 'gradeDaif', fg: 'gradeDaifForeground' },
  [HadithGrade.MAWDU]: { bg: 'gradeMawdu', fg: 'gradeMawduForeground' },
  [HadithGrade.UNGRADED]: { bg: 'muted', fg: 'mutedForeground' },
};

const makeStyles = () => ({
  seal: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 28,
    minWidth: 28,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    justifyContent: 'center' as const,
  },
});

export function GradeBadge({ grade }: { grade: HadithGradeType | null | undefined; compact?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const g = grade ?? HadithGrade.UNGRADED;
  const seal = SEAL[g];
  return (
    <View style={[styles.seal, { backgroundColor: colors[seal.bg] }]}>
      <Text variant="caption" weight="semibold" style={{ color: colors[seal.fg], fontSize: 13, lineHeight: 19 }}>
        {t(`grade.${g}`)}
      </Text>
    </View>
  );
}
