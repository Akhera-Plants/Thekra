/**
 * The reading of one «التفسير» / «الشرح» tab, after the website's StudyReading: each row at reading size, quoted
 * verses in the Quran face, long texts folded at LONG_PREVIEW_CHARS with «اقرأ المزيد», then the source and
 * reference line. Arabic rows read right to left in either UI language.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space, useStyles } from '@/theme';
import { Button, Skeleton, Text } from '@/ui';
import {
  LONG_PREVIEW_CHARS,
  explanationSegments,
  foldedText,
  hasArabicLetters,
  isArabicRow,
  studyCaption,
  type ExplanationRow,
} from '@/lib/study/tabs';

const makeStyles = () => ({
  list: { gap: space['3xl'] },
  row: { gap: space.md },
  rtl: { writingDirection: 'rtl' as const },
  ltr: { writingDirection: 'ltr' as const },
  /** A quoted verse inside the reading: the Quran face, a step larger, on the reading's own line height. */
  verse: { fontSize: 21, lineHeight: 36 },
  toggle: { marginStart: -space.sm },
  skeleton: { gap: space.md },
});

export function StudyReading({ rows }: { rows: ExplanationRow[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <StudyReadingRow key={row.id} row={row} />
      ))}
    </View>
  );
}

function StudyReadingRow({ row }: { row: ExplanationRow }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const handleToggle = useCallback(() => setExpanded((open) => !open), []);
  const arabic = isArabicRow(row);
  const long = row.text.length > LONG_PREVIEW_CHARS;
  const shown = long && !expanded ? foldedText(row.text) : row.text;
  const caption = studyCaption(row, arabic);
  const direction = arabic ? styles.rtl : styles.ltr;

  return (
    <View style={styles.row}>
      <Text variant={arabic ? 'reading' : 'body'} style={direction} textBreakStrategy="highQuality" selectable>
        {explanationSegments(shown).map((segment) =>
          segment.quran ? (
            <Text key={segment.start} variant="quran" tone="link" style={styles.verse}>
              {segment.text}
            </Text>
          ) : (
            segment.text
          ),
        )}
      </Text>
      {long ? (
        <Button
          variant="ghost"
          label={expanded ? t('study.readLess') : t('study.readMore')}
          onPress={handleToggle}
          style={styles.toggle}
        />
      ) : null}
      {caption ? (
        <Text variant="caption" tone="muted" style={hasArabicLetters(caption) ? styles.rtl : styles.ltr}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** The tabs track and a few lines while the readings load. */
export function StudyReadingSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.skeleton} accessibilityLabel={t('common.loading')}>
      <Skeleton width={220} height={44} round />
      <Skeleton height={16} />
      <Skeleton height={16} />
      <Skeleton height={16} />
      <Skeleton width="62%" height={16} />
      <Skeleton width={140} height={12} />
    </View>
  );
}
