import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export default async function HomePage({
  params,
}: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tTheme = await getTranslations('theme');
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold md:text-3xl">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            locale={otherLocale}
            className="text-sm text-muted-foreground transition-[opacity,transform] duration-150 ease-out hover:opacity-90"
          >
            {otherLocale === 'ar' ? 'العربية' : 'English'}
          </Link>
          <ThemeToggle
            labels={{
              toggle: tTheme('toggle'),
              light: tTheme('light'),
              dark: tTheme('dark'),
              system: tTheme('system'),
            }}
          />
        </div>
      </header>
      <p className="text-base text-muted-foreground">{t('description')}</p>
      <p className="text-sm text-muted-foreground">
        {routing.locales.join(' · ')}
      </p>
    </main>
  );
}
