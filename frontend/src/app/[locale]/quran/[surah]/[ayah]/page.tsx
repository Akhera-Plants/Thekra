import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { apiGet } from '@/lib/api-client';
import { rethrowUnlessNotFound } from '@/lib/api/server-guard';
import type { QuoteDto } from '@/lib/types/api';
import type { LocaleCode } from '@/lib/types/enums';
import { StudyFullPage } from '@/features/study-panel/components/StudyFullPage';
import { localeAlternates } from '@/lib/seo';

async function findVerse(surah: number, ayah: number, lang: LocaleCode) {
  const { data } = await apiGet<QuoteDto[]>('/quotes', {
    params: {
      type: ['QURAN_VERSE'],
      surahNumber: surah,
      ayahNumber: ayah,
      limit: 1,
      lang,
    },
  });
  return data[0] ?? null;
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/quran/[surah]/[ayah]'>): Promise<Metadata> {
  const { surah, ayah, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'studyPanel' });
  const verse = await findVerse(Number(surah), Number(ayah), locale as LocaleCode).catch(() => null);
  return { title: verseTitle(t, verse, surah, ayah, locale), alternates: localeAlternates(locale, `/quran/${surah}/${ayah}`) };
}

/** «تفسير البقرة 255» (W-06): the page names its verse; the surah number when the name is missing. */
function verseTitle(
  t: Awaited<ReturnType<typeof getTranslations<'studyPanel'>>>,
  verse: QuoteDto | null,
  surah: string,
  ayah: string,
  locale: string,
): string {
  const name = locale === 'en' ? verse?.quran?.surahName : verse?.quran?.surahNameAr;
  return t('verseTitle', { surah: name || surah, ayah });
}

export default async function QuranStudyPage({
  params,
}: {
  params: Promise<{ locale: string; surah: string; ayah: string }>;
}) {
  const { surah, ayah, locale } = await params;
  setRequestLocale(locale);
  const surahNumber = Number(surah);
  const ayahNumber = Number(ayah);
  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) notFound();

  const tCrumbs = await getTranslations('breadcrumbs');
  const tNav = await getTranslations('nav');
  const t = await getTranslations('studyPanel');

  let quote: QuoteDto | null = null;
  try {
    quote = await findVerse(surahNumber, ayahNumber, locale as LocaleCode);
  } catch (error) {
    rethrowUnlessNotFound('verse page', error);
  }
  if (!quote) notFound();

  return (
    <div className="page-width inner-page flex flex-col gap-6 py-8">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: verseTitle(t, quote, surah, ayah, locale) },
        ]}
      />
      <h1 className="font-arabic-display text-2xl font-semibold md:text-3xl">
        {verseTitle(t, quote, surah, ayah, locale)}
      </h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">{t('loading')}</p>}>
        <StudyFullPage quote={quote} />
      </Suspense>
    </div>
  );
}
