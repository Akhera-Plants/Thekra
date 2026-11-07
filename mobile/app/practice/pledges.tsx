/** «التزام شخصي» is gone (F-08 a): «صلّحها» offers one good deed after two missed days; reviews live in «محاسبتي». Kept so older links and notifications land on the new place (owner round 5, §1 IA). */

import React from 'react';
import { Redirect } from 'expo-router';

export default function PledgesRedirect() {
  return <Redirect href="/habits?tab=review" />;
}
