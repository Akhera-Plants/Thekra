/**
 * «نص اليوم» and its source picker are gone from the app (owner round 6, C-01q). The home-screen widget keeps its
 * daily text from the source already stored in the prefs (`prefs.todayText`, default when none was chosen), so it is
 * unchanged. Kept as a redirect for older links.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function DailyTextRedirect() {
  return <Redirect href="/" />;
}
