'use client';

import { Waves } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activePrograms } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { setMomentSource, setPendingProgram } from '@/lib/practice/local-store';
import { usePracticeStore } from '../hooks/usePracticeStore';

interface StartProgramLinkProps {
  slug: string;
}

/**
 * The one action of a sin page, under its title: «ابدأ «تخفَّف»» (solid), or «تابع برنامجك» (outlined) when this
 * sin's program is already active on the device, beside «أنا في لحظة مجاهدة». The slug goes through device storage, never
 * the URL, so the browser history records only `/practice/leave-sin`, not which sin (roadmap §0.2).
 */
export function StartProgramLink({ slug }: StartProgramLinkProps) {
  const t = useTranslations('leaveSin');
  const tHub = useTranslations('practice.hub.add');
  const snapshot = usePracticeStore();
  const isActive = snapshot ? activePrograms(snapshot.store.programs).some((program) => program.sinSlug === slug) : false;
  return (
    <div className="mt-5 flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice/leave-sin"
          className={isActive ? 'outline-button' : 'solid-button'}
          onClick={isActive ? undefined : () => setPendingProgram(slug)}
        >
          {isActive ? t('continueFromSin') : t('startFromSin')} <DirectionalArrow />
        </Link>
        {/* Shown on every sin page whatever the device holds, so it tells nothing; the screen uses this sin's
            program only if the visitor follows it (in-memory hand-off, never the URL). */}
        <Link href="/practice/leave-sin/moment" className="outline-button" onClick={() => setMomentSource(slug)}>
          <Waves aria-hidden />
          {t('moment.openFromSin')}
        </Link>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">{tHub('programHint')}</p>
    </div>
  );
}
