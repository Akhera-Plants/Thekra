/**
 * «تصفّح النصوص» is gone (owner round 6, C-01l: the texts are reached from «أعنّي على فعل طاعة» and «تخفّف من ذنب»).
 * Kept as a redirect so older links and shares land on the home page (practice-core nav-map `WEB_REDIRECTS`: /browse → /).
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function BrowseRedirect() {
  return <Redirect href="/" />;
}
