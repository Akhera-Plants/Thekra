import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist, Geist_Mono, Noto_Naskh_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { LocaleSync } from '@/components/shared/LocaleSync';
import { AppProviders } from '@/lib/providers';
import { routing } from '@/i18n/routing';

const arabicFont = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
});

const uiFont = Geist({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const monoFont = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

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
      className={`${arabicFont.variable} ${uiFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            <LocaleSync />
            {children}
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
