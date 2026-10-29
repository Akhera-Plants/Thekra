/**
 * The hadith grade as the website's seal (frontend GradeBadge): a small full-radius pill in the grade colour,
 * a tiny check for sahih/hasan only, and always the grade word (never colour alone).
 */

import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { radius, useStyles, useTheme, type Palette } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { HadithGrade } from '@/lib/types/enums';
import type { HadithGrade as HadithGradeType } from '@/lib/types/enums';

const SEAL: Record<HadithGradeType, { bg: keyof Palette; fg: keyof Palette; check: boolean }> = {
  [HadithGrade.SAHIH]: { bg: 'gradeSahih', fg: 'gradeSahihForeground', check: true },
  [HadithGrade.HASAN]: { bg: 'gradeHasan', fg: 'gradeHasanForeground', check: true },
  [HadithGrade.DAIF]: { bg: 'gradeDaif', fg: 'gradeDaifForeground', check: false },
  [HadithGrade.MAWDU]: { bg: 'gradeMawdu', fg: 'gradeMawduForeground', check: false },
  [HadithGrade.UNGRADED]: { bg: 'muted', fg: 'mutedForeground', check: false },
};

const makeStyles = () => ({
  seal: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    minHeight: 28,
    minWidth: 28,
    paddingHorizontal: 8,
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
      {seal.check ? <Icon icon={Check} size={12} color={colors[seal.fg]} strokeWidth={2} /> : null}
      <Text variant="caption" weight="semibold" style={{ color: colors[seal.fg], fontSize: 12, lineHeight: 18 }}>
        {t(`grade.${g}`)}
      </Text>
    </View>
  );
}
