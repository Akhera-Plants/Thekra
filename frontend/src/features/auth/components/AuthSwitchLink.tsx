'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { safeNextPath } from '../next-path';

const noSubscribe = () => () => {};
const readNext = () => safeNextPath(new URLSearchParams(window.location.search).get('next'), '');

/** «إنشاء حساب» ↔ «تسجيل الدخول»: keeps `?next=`, so a guest sent from «ورد اليوم» still lands back there. */
export function AuthSwitchLink({ to, className, children }: { to: '/login' | '/register'; className?: string; children: ReactNode }) {
  const next = useSyncExternalStore(noSubscribe, readNext, () => '');
  return (
    <Link href={next ? { pathname: to, query: { next } } : to} className={className}>
      {children}
    </Link>
  );
}
