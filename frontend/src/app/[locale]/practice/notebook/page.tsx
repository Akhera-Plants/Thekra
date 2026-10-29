import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { NotebookView } from '@/features/practice/components/NotebookView';

/**
 * «دفتر المحاسبة»: the visitor's own notebook, read from this browser only. No index and no sitemap entry; a static
 * shell (the server has nothing of it).
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/notebook'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tazkiya' });
  return { title: t('notebookTitle'), robots: { index: false, follow: false } };
}

export default async function NotebookPage({ params }: PageProps<'/[locale]/practice/notebook'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tazkiya');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('practice'), href: '/practice' }, { label: t('notebookTitle') }]}
      />
      <header className="page-heading">
        <p className="eyebrow">{tNav('practice')}</p>
        <h1 id="page-title" tabIndex={-1}>
          {t('notebookTitle')}
        </h1>
        <p className="page-lead">{t('notebookLead')}</p>
      </header>
      <NotebookView />
    </div>
  );
}
