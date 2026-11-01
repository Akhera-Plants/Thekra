/** Reminder switches live in one place only, «التنبيهات» in Settings (redesign §4.4); other screens link to it. */

import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react-native';
import { ListRow } from '@/ui';

const openSettings = () => router.push('/settings/notifications');

export function NotificationsLink() {
  const { t } = useTranslation();
  return <ListRow icon={Bell} title={t('practice.notifyPrefs.title')} hint={t('practice.notifyPrefs.linkHint')} chevron onPress={openSettings} />;
}
