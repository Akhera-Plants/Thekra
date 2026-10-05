import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { SinPickerSheet } from '@/features/sin-reminder/components/SinPickerSheet';
import { GoodDeedPickerSheet } from '@/features/good-deed-motivation/components/GoodDeedPickerSheet';
import { Link } from '@/i18n/navigation';

export default async function HomePage({
  params,
}: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12">
      {/* Brand header */}
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-base text-muted-foreground">{t('tagline')}</p>
      </header>

      {/* Two primary entry actions */}
      <section
        aria-label={t('sinEntryLabel')}
        className="grid gap-4 sm:grid-cols-2"
      >
        <SinPickerSheet
          triggerLabel={t('sinEntryLabel')}
          triggerDescription={t('sinEntryDescription')}
          className="h-auto w-full py-5 text-base"
        />
        <GoodDeedPickerSheet
          triggerLabel={t('deedEntryLabel')}
          triggerDescription={t('deedEntryDescription')}
          className="h-auto w-full py-5 text-base"
        />
      </section>

      {/* Browse link */}
      <div className="flex justify-center">
        <Link
          href="/browse"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('browseLabel')}
        </Link>
      </div>
    </div>
  );
}
