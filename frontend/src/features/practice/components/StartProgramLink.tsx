'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { setPendingProgram } from '@/lib/practice/local-store';

interface StartProgramLinkProps {
  slug: string;
}

/**
 * Quiet link from a sin page to «ترك المعصية». The slug goes through device storage, never the URL, so the
 * browser history records only `/practice/leave-sin`, not which sin (roadmap §0.2).
 */
export function StartProgramLink({ slug }: StartProgramLinkProps) {
  const t = useTranslations('leaveSin');
  return (
    <Link href="/practice/leave-sin" className="text-link self-start" onClick={() => setPendingProgram(slug)}>
      {t('startFromSin')} <DirectionalArrow />
    </Link>
  );
}
