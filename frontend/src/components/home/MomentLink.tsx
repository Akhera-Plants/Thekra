'use client';

import type { ReactNode } from 'react';
import { activePrograms } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { setMomentSource } from '@/lib/practice/local-store';
import type { HomeMoment } from '@/lib/api/home-moments';

/**
 * One row of «في لحظات مثل هذه» (owner round 8, item 8): it opens its topic page, except a row about a sin whose
 * «تخفَّف» program runs on this device: that opens «لحظة مجاهدة» for that program (the sin goes through memory, never
 * the URL). Without a program the row lands on the sin's page as before.
 */
export function MomentLink({ moment, className, children }: { moment: HomeMoment; className?: string; children: ReactNode }) {
  const snapshot = usePracticeStore();
  const hasProgram =
    moment.topic.type === 'sin' &&
    snapshot !== null &&
    activePrograms(snapshot.store.programs).some((program) => program.sinSlug === moment.topic.slug);
  if (hasProgram) {
    return (
      <Link href="/practice/leave-sin/moment" className={className} onClick={() => setMomentSource(moment.topic.slug)}>
        {children}
      </Link>
    );
  }
  return (
    <Link href={moment.topic.path} className={className}>
      {children}
    </Link>
  );
}
