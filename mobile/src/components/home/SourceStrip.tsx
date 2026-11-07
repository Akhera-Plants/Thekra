/**
 * «تذكير تعرف مصدره», after the website's SourceStrip: the books whose texts are read here, most published first, as
 * wordmarks (Amiri in Arabic, Source Serif in English, like the site's `.source-mark-title`). The site's strip drifts
 * on its own; here the names wrap in lines inside the width (owner round 5, A-31: the swiped row ran off the edge).
 * When the API cannot answer, the site's short fallback list is shown, so the strip always has content.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FALLBACK_SOURCE_NAMES } from '@/lib/api/sources';
import { space, WORDMARK_FONT, useStyles, type Theme } from '@/theme';
import { Section, Skeleton, Text } from '@/ui';

interface ISourceStripProps {
  names: readonly string[] | undefined;
  isLoading: boolean;
}

const SKELETON_MARKS = ['m1', 'm2', 'm3'];

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space['3xl'], paddingVertical: space.sm },
  /** The names wrap inside the width (A-31): nothing runs off the screen edge, nothing to swipe. */
  wrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'baseline' as const, columnGap: space['2xl'], rowGap: 0 },
  /** `.source-mark-title`: the Arabic wordmark face; English keeps the UI serif. */
  mark: t.english ? {} : { fontFamily: WORDMARK_FONT, fontSize: 24, lineHeight: 44 },
});

export function SourceStrip({ names, isLoading }: ISourceStripProps) {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const shown = names && names.length > 0 ? names : isLoading ? null : FALLBACK_SOURCE_NAMES[i18n.language === 'en' ? 'en' : 'ar'];

  return (
    <Section title={t('home.sourcesHeading')} lead={t('home.sourcesLead')}>
      {shown ? (
        <View
          style={styles.wrap}
          accessible
          accessibilityLabel={`${t('home.sourcesAria')}: ${shown.join(i18n.language === 'en' ? ', ' : '، ')}`}
        >
          {shown.map((name) => (
            <Text key={name} variant="heading" style={styles.mark} importantForAccessibility="no">
              {name}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.row} accessibilityLabel={t('common.loading')}>
          {SKELETON_MARKS.map((key) => (
            <Skeleton key={key} width={96} height={20} />
          ))}
        </View>
      )}
    </Section>
  );
}
