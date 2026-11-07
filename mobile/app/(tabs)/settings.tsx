/** The old «الإعدادات» tab route (`/settings`): its rows are the last group of «المزيد» now (owner round 5, §1). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function SettingsRedirect() {
  return <Redirect href="/more" />;
}
