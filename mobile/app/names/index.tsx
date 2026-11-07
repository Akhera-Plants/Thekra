/** «الأسماء الحسنى» UI is removed (F-19 a; the API stays). Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function NamesRedirect() {
  return <Redirect href="/" />;
}
