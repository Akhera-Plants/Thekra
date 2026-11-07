/** The old «عاداتي» route: every habit is listed in «عاداتي › سجلّي». Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function HabitsRedirect() {
  return <Redirect href="/habits?tab=record" />;
}
