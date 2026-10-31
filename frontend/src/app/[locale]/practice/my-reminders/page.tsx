import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { MyRemindersView } from '@/features/practice/components/screen/MyRemindersView';
import { localeAlternates } from '@/lib/seo';

// A static shell: everything on this page is read from and kept on this device.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/my-reminders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.myReminders' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/my-reminders') };
}

export default async function Page({ params }: PageProps<'/[locale]/practice/my-reminders'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.myReminders');
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
      <MyRemindersView />
    </div>
  );
}
