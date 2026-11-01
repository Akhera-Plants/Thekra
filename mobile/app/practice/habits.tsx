/**
 * The old «عاداتي» route: habit management now lives in the «عاداتي» tab (owner, 2026-11-01: one «عاداتي», not two).
 * Kept so links, strategies and older notifications that open `/practice/habits` still land in the right place.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function HabitsRedirect() {
  return <Redirect href="/(tabs)/record" />;
}
