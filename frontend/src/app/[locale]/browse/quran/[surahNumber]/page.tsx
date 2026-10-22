import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getSurahs } from '@/lib/api/quran';
import { SurahView } from '@/features/quran-hadith-browser/components/SurahView';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/browse/quran/[surahNumber]'>) {
  const { surahNumber, locale } = await params;
  try {
    const { data } = await getSurahs();
    const surah = data.find((s) => String(s.surahNumber) === surahNumber);
    if (!surah) return {};
    const t = await getTranslations({ locale, namespace: 'surah' });
    return {
      title: t('pageTitle', {
        name: surah.surahNameAr ?? surah.surahName ?? surahNumber,
      }),
    };
  } catch {
    return {};
  }
}

export default async function SurahPage({
  params,
}: PageProps<'/[locale]/browse/quran/[surahNumber]'>) {
  const { surahNumber, locale } = await params;
  setRequestLocale(locale);

  let surah: Awaited<ReturnType<typeof getSurahs>>['data'][number] | null = null;
  try {
    const { data } = await getSurahs();
    surah = data.find((s) => String(s.surahNumber) === surahNumber) ?? null;
  } catch {
    // handle below
  }

  if (!surah) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <SurahView surah={surah} />
    </div>
  );
}
