'use client';

import { Waves } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { activePrograms } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
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
      {/* One primary «ابدأ تخفَّف» (F-10 a) and its companion «أنا في لحظة مجاهدة» as one pair, same size (O-02). */}
      <ActionPair layout="hug">
        <Button asChild variant={isActive ? 'outline' : 'solid'} tone="primary" size="md">
          <Link href="/practice/leave-sin" onClick={isActive ? undefined : () => setPendingProgram(slug)}>
            {isActive ? t('continueFromSin') : t('startFromSin')} <DirectionalArrow />
          </Link>
        </Button>
        {/* Shown on every sin page whatever the device holds, so it tells nothing; the screen uses this sin's
            program only if the visitor follows it (in-memory hand-off, never the URL). */}
        <Button asChild variant="outline" tone="primary" size="md">
          <Link href="/practice/leave-sin/moment" onClick={() => setMomentSource(slug)}>
            <Waves aria-hidden />
            {t('moment.openFromSin')}
          </Link>
        </Button>
      </ActionPair>
      <p className="text-sm leading-7 text-muted-foreground">{tHub('programHint')}</p>
    </div>
  );
}
