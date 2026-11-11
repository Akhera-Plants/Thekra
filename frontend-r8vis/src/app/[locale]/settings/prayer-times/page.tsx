import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { MembersOnly } from '@/features/auth/components/MembersOnly';
import { PrayerTimesView } from '@/features/practice/components/screen/PrayerTimesView';

// «الإعدادات › أوقات الصلاة» (moved from /practice/prayer-times, round 5). A static shell: kept on this device.
export async function generateMetadata({ params }: PageProps<'/[locale]/settings/prayer-times'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.prayer' });
  return { title: t('title'), description: t('lead') };
}

export default async function Page({ params }: PageProps<'/[locale]/settings/prayer-times'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.prayer');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('settings'), href: '/settings' }, { label: t('title') }]}
      />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <MembersOnly>
        <PrayerTimesView />
      </MembersOnly>
    </div>
  );
}
