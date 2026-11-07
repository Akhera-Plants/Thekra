/** «مواسم الخير» is gone (F-17): occasions are marked on «عاداتي › سجلّي». Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function CalendarRedirect() {
  return <Redirect href="/habits?tab=record" />;
}
