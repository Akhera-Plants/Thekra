'use client';

import { useTranslations } from 'next-intl';
import { activePrograms } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { setPendingProgram } from '@/lib/practice/local-store';
import { usePracticeStore } from '../hooks/usePracticeStore';

interface StartProgramLinkProps {
  slug: string;
}

/**
 * Quiet link from a sin page to «ترك المعصية»: «ابدأ برنامج الترك», or «تابع برنامجك» when this sin's program is
 * already active on the device. The slug goes through device storage, never the URL, so the browser history
 * records only `/practice/leave-sin`, not which sin (roadmap §0.2).
 */
export function StartProgramLink({ slug }: StartProgramLinkProps) {
  const t = useTranslations('leaveSin');
  const tHub = useTranslations('practice.hub.add');
  const snapshot = usePracticeStore();
  const isActive = snapshot ? activePrograms(snapshot.store.programs).some((program) => program.sinSlug === slug) : false;
  return (
    <div className="flex flex-col items-start">
      <Link
        href="/practice/leave-sin"
        className="text-link"
        onClick={isActive ? undefined : () => setPendingProgram(slug)}
      >
        {isActive ? t('continueFromSin') : t('startFromSin')} <DirectionalArrow />
      </Link>
      <p className="text-sm leading-7 text-muted-foreground">{tHub('programHint')}</p>
    </div>
  );
}
