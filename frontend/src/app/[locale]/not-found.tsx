'use client';

import { useTranslations } from 'next-intl';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Link } from '@/i18n/navigation';

export default function LocaleNotFound() {
  const t = useTranslations('feedback.notFound');
  return (
    <div className="page-width inner-page">
      <div className="empty-state">
        <h1 id="page-title" tabIndex={-1}>{t('title')}</h1>
        <p>{t('body')}</p>
        <Link href="/" className="solid-button">
          {t('home')} <DirectionalArrow className="size-[18px]" />
        </Link>
      </div>
    </div>
  );
}
