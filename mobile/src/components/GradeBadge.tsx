/**
 * GradeBadge — displays the hadith authenticity grade.
 *
 * Design rules (mobile-plan §3, ARCHITECTURE.md authenticity requirement):
 *  - Never convey grade by colour alone — always show the grade word.
 *  - Quran verses have no hadith grade; show "قرآن" / "Quran" instead.
 *  - MAWDU is filtered by the API and should never appear; shown defensively.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import { HadithGrade } from '@/lib/types/enums';
import type { HadithGrade as HadithGradeType } from '@/lib/types/enums';

interface GradeBadgeProps {
  grade: HadithGradeType | null | undefined;
  /** If true, render a compact pill (smaller padding). */
  compact?: boolean;
}

const GRADE_STYLES: Record<
  HadithGradeType,
  { color: string; backgroundColor: string }
> = {
  [HadithGrade.SAHIH]:    { color: Colors.gradeSahih,    backgroundColor: Colors.gradeSahihBg },
  [HadithGrade.HASAN]:    { color: Colors.gradeHasan,    backgroundColor: Colors.gradeHasanBg },
  [HadithGrade.DAIF]:     { color: Colors.gradeDaif,     backgroundColor: Colors.gradeDaifBg },
  [HadithGrade.MAWDU]:    { color: Colors.gradeMawdu,    backgroundColor: Colors.gradeMawduBg },
  [HadithGrade.UNGRADED]: { color: Colors.gradeUngraded, backgroundColor: Colors.gradeUngradedBg },
};

export function GradeBadge({ grade, compact = false }: GradeBadgeProps) {
  const { t } = useTranslation();

  // Quran verses have no hadith grade — render as UNGRADED with Quran label
  const effectiveGrade = grade ?? HadithGrade.UNGRADED;
  const { color, backgroundColor } = GRADE_STYLES[effectiveGrade];
  const label = t(`grade.${effectiveGrade}`);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor },
        compact && styles.compact,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color }, compact && styles.compactText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['1'],
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  compactText: {
    fontSize: 10,
  },
});
