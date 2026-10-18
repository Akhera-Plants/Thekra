import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Geist_Mono, Source_Sans_3 } from 'next/font/google';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { LocaleSync } from '@/components/shared/LocaleSync';
import { amiri, amiriQuran, plexArabic, thmanyahDisplay, thmanyahSans, thmanyahText } from '@/lib/fonts';
import { AppProviders } from '@/lib/providers';
import { routing } from '@/i18n/routing';

/** Adobe Source Sans 3 — English UI and reading text. */
const uiFont = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

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
  return { title: t('name') };
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
      className={`${thmanyahDisplay.variable} ${thmanyahText.variable} ${thmanyahSans.variable} ${plexArabic.variable} ${amiri.variable} ${amiriQuran.variable} ${uiFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className={`flex min-h-full flex-col ${locale === 'ar' ? 'font-arabic-ui' : 'font-sans'}`}
      >
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            <LocaleSync />
            <AppShell>{children}</AppShell>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
