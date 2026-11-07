import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { HabitsTabBar } from '@/features/practice/components/tabs/HabitsTabBar';

/**
 * «عاداتي» (owner round 5, §1 Web table): one title and one tab bar «ورد اليوم · الدورية · محاسبتي · سجلّي» over four
 * routes (`/practice`, `/practice/periodic`, `/practice/review`, `/practice/record`). Each tab is a page of its own, so a
 * link, a reload or a notification opens it directly; the bar stays while the next tab loads.
 */
export default async function HabitsLayout({ children, params }: LayoutProps<'/[locale]/practice'>) {
  // Static like every practice shell: the locale comes from the route, never from the request headers.
  setRequestLocale((await params).locale);
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('menuItems.habits') }]} />
      <header className="page-heading !mb-6 flex !max-w-none flex-col gap-5">
        <h1 id="page-title" tabIndex={-1}>
          {tNav('menuItems.habits')}
        </h1>
        <HabitsTabBar />
      </header>
      {children}
    </div>
  );
}
