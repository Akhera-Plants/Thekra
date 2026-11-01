/**
 * The app header on every tab: the wordmark «ذكرى» with the tagline («لِمَن كَانَ لَهُۥ قَلْبٌ», the site header's
 * `.brand-message`) right next to it, and the menu button on the opposite, inline-end side (owner, 2026-11-01), framed
 * like every other control; it opens `SideMenu` from that same side.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react-native';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { BrandBar, IconButton, Text } from '@/ui';
import { SideMenu } from './SideMenu';

const makeStyles = (t: Theme) => ({
  /** `.brand-message`: Amiri Quran, muted, after a hairline (English: the UI face). */
  tagline: {
    borderStartWidth: 1,
    borderStartColor: t.colors.border,
    paddingStart: space.md,
    ...(t.english ? {} : { fontSize: 15, lineHeight: 28 }),
  },
});

/** The tagline is Quran text (Qaf 50:37) in Arabic, so it takes the Quran face; English reads it in the UI face. */
function Tagline() {
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Text variant={english ? 'caption' : 'quran'} tone="muted" style={styles.tagline} numberOfLines={english ? 2 : 1}>
      {t('app.tagline')}
    </Text>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <>
      <BrandBar tagline={<Tagline />} end={<IconButton icon={Menu} label={t('menu.open')} tone="default" bordered onPress={handleOpen} />} />
      <SideMenu visible={open} onClose={handleClose} />
    </>
  );
}
