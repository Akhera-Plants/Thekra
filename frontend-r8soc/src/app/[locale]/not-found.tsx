'use client';

import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Link } from '@/i18n/navigation';

/**
 * «الصفحة غير موجودة» (owner round 6, C-22: the reference's whole component, the button «العودة إلى الرئيسية»): the
 * breadcrumb and the page title, then one centred block — what happened, why, and the single way back.
 */
export default function LocaleNotFound() {
  const t = useTranslations('feedback.notFound');
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('title') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
      </header>
      <section aria-labelledby="not-found-lead" className="not-found-block">
        <h2 id="not-found-lead" className="text-2xl font-medium md:text-[28px]">
          {t('lead')}
        </h2>
        <p className="text-base leading-8 text-muted-foreground">{t('body')}</p>
        <Link href="/" className="solid-button">
          {t('home')}
        </Link>
      </section>
    </div>
  );
}
