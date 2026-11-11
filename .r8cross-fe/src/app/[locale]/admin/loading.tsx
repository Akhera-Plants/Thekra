'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';

/** The admin desk has its own shell, so its fallback is just the loader. */
export default function AdminLoading() {
  const t = useTranslations('feedback');
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center" data-route-loading>
      <BrandLoader label={t('loadingPage')} size="page" />
    </div>
  );
}
