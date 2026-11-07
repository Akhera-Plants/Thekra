/** «أعمال دورية» is the «الدورية» tab of «عاداتي». Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function PeriodicRedirect() {
  return <Redirect href="/habits?tab=periodic" />;
}
