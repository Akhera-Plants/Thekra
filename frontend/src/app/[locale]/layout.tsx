import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { NavigationProgress } from '@/components/shared/feedback/NavigationProgress';
import { LocaleSync } from '@/components/shared/LocaleSync';
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister';
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
      images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: name }],
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
    },
    twitter: { card: 'summary', description },
    // Installed (PWA) copy on iOS: name under the icon, normal status bar.
    appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
}

/** Browser bar colour = the page colour of each theme (globals.css --background), so nothing changes visually. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#101010' },
  ],
};

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
            <ServiceWorkerRegister />
            <NavigationProgress />
            <AppShell>{children}</AppShell>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
