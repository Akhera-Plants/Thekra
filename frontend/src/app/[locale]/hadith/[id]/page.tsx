import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { getQuote } from '@/lib/api/quotes';
import { rethrowUnlessNotFound } from '@/lib/api/server-guard';
import type { LocaleCode } from '@/lib/types/enums';
import { StudyFullPage } from '@/features/study-panel/components/StudyFullPage';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/hadith/[id]'>): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'studyPanel' });
  try {
    const { data } = await getQuote(id, { lang: locale as LocaleCode });
    if (data.type !== 'HADITH') return { title: t('titleSharh') };
    const source = locale === 'en' ? (data.source.name || data.source.nameAr) : (data.source.nameAr || data.source.name);
    return { title: source ? `${t('titleSharh')}: ${source}` : t('titleSharh') };
  } catch {
    return { title: t('titleSharh') };
  }
}

export default async function HadithStudyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const tCrumbs = await getTranslations('breadcrumbs');
  const tNav = await getTranslations('nav');
  const t = await getTranslations('studyPanel');

  let quote: Awaited<ReturnType<typeof getQuote>>['data'] | null = null;
  try {
    const result = await getQuote(id, { lang: locale as LocaleCode });
    quote = result.data;
  } catch (error) {
    rethrowUnlessNotFound('hadith page', error);
  }
  if (!quote || quote.type !== 'HADITH') notFound();

  return (
    <div className="page-width inner-page flex flex-col gap-6 py-8">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: t('titleSharh') },
        ]}
      />
      <h1 className="font-arabic-display text-2xl font-semibold md:text-3xl">
        {t('titleSharh')}
      </h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">{t('loading')}</p>}>
        <StudyFullPage quote={quote} />
      </Suspense>
    </div>
  );
}
