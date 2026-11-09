/**
 * Settings ← «عن ذكرى» (owner round 6, C-21: the reference's short page, our content — the website's about texts):
 * an eyebrow and one headline, a short intro, then short parts under the flower divider: «منهجية المحتوى», «فلسفة ذكرى»
 * (its four conditions, one line each), «النصوص المفتوحة», «الخصوصية»; then the full methodology and the privacy page
 * on the site, and the version.
 */

import React from 'react';
import { Linking, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { BookOpen, ExternalLink, FileText, Info } from 'lucide-react-native';
import { SITE_ABOUT_PATH, SITE_PRIVACY_PATH, sitePageUrl } from '@/lib/site';
import { space } from '@/theme';
import { Icon, ListRow, PageHeader, Screen, SectionDivider, SectionHeader, Text } from '@/ui';

const CONDITIONS = ['remembrance', 'heart', 'listening', 'presence'] as const;

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title={title} size="heading" />
      {children}
    </View>
  );
}

export default function AboutSettingsScreen() {
  const { t, i18n } = useTranslation();
  const version = Constants.expoConfig?.version ?? '0.1.0';
  const openSite = (path: string) => () => void Linking.openURL(sitePageUrl(path, i18n.language)).catch(() => undefined);
  const external = <Icon icon={ExternalLink} size={18} tone="muted" />;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.about') }} />
      <PageHeader title={t('settings.about')} />
      <View style={{ gap: space.md }}>
        <Text variant="small" tone="muted">
          {t('aboutPage.eyebrow')}
        </Text>
        <Text variant="display">{t('aboutPage.lead')}</Text>
        <Text variant="body" tone="muted">
          {t('aboutPage.intro')}
        </Text>
      </View>
      <SectionDivider />
      <Part title={t('aboutPage.methodologyTitle')}>
        <Text variant="body" tone="muted">
          {t('aboutPage.methodologyBody')}
        </Text>
      </Part>
      <SectionDivider />
      <Part title={t('aboutPage.philosophyTitle')}>
        <View style={{ gap: space.md }}>
          {CONDITIONS.map((key) => (
            <View key={key} style={{ gap: 2 }}>
              <Text variant="body" weight="medium">
                {t(`aboutPage.conditions.${key}.title`)}
              </Text>
              <Text variant="small" tone="muted">
                {t(`aboutPage.conditions.${key}.line`)}
              </Text>
            </View>
          ))}
        </View>
      </Part>
      <SectionDivider />
      <Part title={t('aboutPage.openitiTitle')}>
        <Text variant="body" tone="muted">
          {t('aboutPage.openitiBody')}
        </Text>
      </Part>
      <SectionDivider />
      <Part title={t('aboutPage.privacyTitle')}>
        <Text variant="body" tone="muted">
          {t('aboutPage.privacyBody')}
        </Text>
      </Part>
      <View>
        <ListRow icon={BookOpen} title={t('aboutPage.more')} onPress={openSite(SITE_ABOUT_PATH)} trailing={external} />
        <ListRow icon={FileText} title={t('settings.privacyPolicy')} onPress={openSite(SITE_PRIVACY_PATH)} trailing={external} />
        <ListRow icon={Info} title={t('settings.version')} value={version} last />
      </View>
    </Screen>
  );
}
