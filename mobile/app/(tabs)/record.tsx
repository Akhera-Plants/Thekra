/** The old «عاداتي» tab route (`/record`): it lives in «عاداتي › سجلّي» now (owner round 5, §1). Kept for older links. */

import React from 'react';
import { Redirect } from 'expo-router';

export default function RecordRedirect() {
  return <Redirect href="/habits?tab=record" />;
}
