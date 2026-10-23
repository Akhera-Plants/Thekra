import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { NavigationProgress } from '@/components/shared/feedback/NavigationProgress';
import { LocaleSync } from '@/components/shared/LocaleSync';
import { amiri, amiriQuran, plexArabic, sourceSerif, thmanyahDisplay, thmanyahSans, thmanyahText } from '@/lib/fonts';
import { env } from '@/lib/env';
import { AppProviders } from '@/lib/providers';
import { routing } from '@/i18n/routing';

const monoFont = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  const name = t('name');
  const description = t('description');
  return {
    metadataBase: new URL(env.SITE_ORIGIN),
    applicationName: name,
    // Child pages pass their own topic or branch name; the template adds the app name.
    title: { default: name, template: `%s · ${name}` },
    description,
    openGraph: {
      type: 'website',
      siteName: name,
      description,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
    },
    twitter: { card: 'summary', description },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${thmanyahDisplay.variable} ${thmanyahText.variable} ${thmanyahSans.variable} ${plexArabic.variable} ${amiri.variable} ${amiriQuran.variable} ${sourceSerif.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className={`flex min-h-full flex-col ${locale === 'ar' ? 'font-arabic-ui' : 'font-english'}`}
      >
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            <LocaleSync />
            <NavigationProgress />
            <AppShell>{children}</AppShell>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
