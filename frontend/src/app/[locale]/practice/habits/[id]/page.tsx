import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Suspense } from 'react';
import { HabitPage } from '@/features/practice/components/habit/HabitPage';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';

// «صفحة العادة» (round 6 §3: the «عاداتي» tabs, a wide header and the reference tabs). The habit lives on the device: the id is all the server knows, so the title stays generic.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/habits/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('habit')} · ${t('habits')}`, robots: { index: false } };
}

export default async function HabitRoute({ params }: PageProps<'/[locale]/practice/habits/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tNav('menuItems.habits'), href: '/practice' },
          { label: tNav('menuItems.my-habits'), href: '/practice/habits' },
          { label: tNav('menuItems.habit') },
        ]}
      />
      {/* HabitPage reads `?tab=` (a link straight to «العودة بعد انقطاع»…), so it renders under Suspense. */}
      <Suspense fallback={<PracticeLoading />}>
        <HabitPage id={id} />
      </Suspense>
    </div>
  );
}
