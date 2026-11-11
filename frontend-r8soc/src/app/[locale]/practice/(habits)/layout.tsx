import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SelfMessagesButton } from '@/features/practice/components/messages/SelfMessages';
import { HabitsTabBar } from '@/features/practice/components/tabs/HabitsTabBar';

/**
 * «عاداتي» (round 6 §2): one title with «رسائلي إلى نفسي» opposite it (C-02c: moved out of «محاسبتي» to the top of
 * «عاداتي»), then the reference underline tabs «اليوم · العادات · الأعمال الدورية · محاسبتي · سجلّي» over five routes
 * (`/practice`, `/practice/habits`, `/practice/periodic`, `/practice/review`, `/practice/record`). Each tab is a page of
 * its own, so a link, a reload or a notification opens it directly; the bar stays while the next tab loads.
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
        <TitleRow action={<SelfMessagesButton />}>
          <h1 id="page-title" tabIndex={-1}>
            {tNav('menuItems.habits')}
          </h1>
        </TitleRow>
        <HabitsTabBar />
      </header>
      {children}
    </div>
  );
}
