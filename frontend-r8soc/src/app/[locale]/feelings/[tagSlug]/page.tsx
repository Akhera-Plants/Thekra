import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getTag } from '@/lib/api/tags';
import { localeAlternates } from '@/lib/seo';
import { Suspense } from 'react';
import { FeelingsView } from './_FeelingsView';

/** «الغضب · ذكرى» in the tab (W-18): the feeling's own name in the page language. */
export async function generateMetadata({ params }: PageProps<'/[locale]/feelings/[tagSlug]'>): Promise<Metadata> {
  const { tagSlug, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'feelings' });
  try {
    const { data } = await getTag(tagSlug);
    const name = locale === 'en' ? (data.name || null) : (data.nameAr || null);
    return {
      title: name ?? t('fallbackTitle'),
      alternates: localeAlternates(locale, `/feelings/${tagSlug}`),
    };
  } catch {
    return { title: t('fallbackTitle') };
  }
}

export default async function FeelingsPage({
  params,
}: PageProps<'/[locale]/feelings/[tagSlug]'>) {
  const { tagSlug, locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <FeelingsView tagSlug={tagSlug} />
    </Suspense>
  );
}
