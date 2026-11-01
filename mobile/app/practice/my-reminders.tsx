/**
 * The old «تذكيراتي» route: the lines now live in «المحفوظات», in its «تذكيراتي» part (owner, 2026-11-01). Kept so
 * older links still land there.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function MyRemindersRedirect() {
  return <Redirect href={{ pathname: '/favorites', params: { part: 'mine' } }} />;
}
