'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';

/** Shown until the device store is read (it does not exist during the server render). */
export function PracticeLoading() {
  const t = useTranslations('feedback');
  return (
    <div className="flex justify-center py-12">
      <BrandLoader label={t('loading')} size="page" />
    </div>
  );
}
