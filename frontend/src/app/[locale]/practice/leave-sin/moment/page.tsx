import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { MujahadaView } from '@/features/practice/components/MujahadaView';
import { getAyah } from '@/lib/api/quran';
import { reportFailure } from '@/lib/errors';
import type { LocaleCode } from '@/lib/types/enums';

/**
 * «لحظة مجاهدة» (was «لحظة ضعف»): a generic title (never a sin name), no index, under the private `practice/leave-sin` path (robots).
 * The only server request is the stored verse Al-A'raf 7:201 (shown only until the catalog's patience verses arrive), the same for every visitor (content rule §3.1).
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/leave-sin/moment'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leaveSin' });
  return { title: { absolute: t('genericTitle') }, robots: { index: false, follow: false } };
}

export default async function MujahadaPage({ params }: PageProps<'/[locale]/practice/leave-sin/moment'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('leaveSin');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  const verse = await getAyah(7, 201, { lang: locale as LocaleCode })
    .then((result) => result.data)
    .catch((error: unknown) => {
      reportFailure('mujahada verse', error);
      return null;
    });
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: t('title'), href: '/practice/leave-sin' }, { label: t('moment.title') }]}
      />
      <header className="page-heading mx-auto w-full max-w-2xl">
        <h1 id="page-title" tabIndex={-1}>
          {t('moment.title')}
        </h1>
        <p className="page-lead">{t('moment.lead')}</p>
      </header>
      <MujahadaView verse={verse} />
    </div>
  );
}
