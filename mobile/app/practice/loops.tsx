/** The loop builder is gone (F-13 a): «أضف» asks two optional questions, shown on the habit page. Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function LoopsRedirect() {
  return <Redirect href="/habits" />;
}
