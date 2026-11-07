/** «فروضي وأدواري» is gone (F-28 a): the free-minutes question is asked in «أضف» the first time. Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function DutiesRedirect() {
  return <Redirect href="/habits" />;
}
