'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { safeNextPath } from '../next-path';

const noSubscribe = () => () => {};
const readQuery = () => window.location.search;

type Why = 'bookmark' | 'habits' | 'moment' | 'sin' | 'reminders';

/** Where the person was headed says why an account is needed (owner round 8, item 1). */
function whyOf(search: string): Why | null {
  const params = new URLSearchParams(search);
  const explicit = params.get('why');
  if (explicit === 'bookmark' || explicit === 'reminders') return explicit;
  const next = safeNextPath(params.get('next'), '');
  if (!next) return null;
  if (next.startsWith('/practice/leave-sin/moment')) return 'moment';
  if (next.startsWith('/practice/leave-sin')) return 'sin';
  if (next.startsWith('/practice')) return 'habits';
  return null;
}

/** One quiet line under the sign-in / sign-up title: why this page appeared. Nothing when the person came on their own. */
export function AuthWhy() {
  const t = useTranslations('auth.why');
  const search = useSyncExternalStore(noSubscribe, readQuery, () => '');
  const why = whyOf(search);
  if (!why) return null;
  return <p className="text-sm text-foreground">{t(why)}</p>;
}
