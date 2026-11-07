/**
 * The old «تذكيراتي» route: the lines live in «المحفوظات», in its «تذكيراتي» tab (owner round 5, F-22 a). Kept so older
 * links still land there.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function MyRemindersRedirect() {
  return <Redirect href={{ pathname: '/favorites', params: { tab: 'reminders' } }} />;
}
