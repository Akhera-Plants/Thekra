import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { KitSpecimen } from './KitSpecimen';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Kit specimen — Thekra',
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Living specimen for kit/Button (+ SegmentTabs).
 * Open `/dev/kit` (or `/en/dev/kit`) to visually audit every variant × tone × size.
 * Not linked in the product nav.
 */
export default async function KitSpecimenPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 md:px-8 md:py-14">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          frontend/src/components/shared/kit
        </p>
        <h1 className="font-arabic-display text-3xl md:text-4xl">Kit specimen</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Matrix for Claude (and humans) to verify that each Button variant × tone looks like a
          control, matches Scholar&apos;s Desk tokens, and follows the nexa fill-on-hover outline
          rule. Toggle the site theme from the header.
        </p>
      </header>
      <KitSpecimen />
    </main>
  );
}
