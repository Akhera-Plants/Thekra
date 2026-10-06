import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getSin, getSinQuotes } from '@/lib/api/sins';
import { createQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { LocaleCode } from '@/lib/types/enums';
import { SinHeader } from '@/features/sin-reminder/components/SinHeader';
import { ReminderList } from '@/features/sin-reminder/components/ReminderList';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sins/[slug]'>) {
  const { slug, locale } = await params;
  try {
    const { data } = await getSin(slug, locale as LocaleCode);
    return { title: `${data.nameAr} — ذكرى` };
  } catch {
    return {};
  }
}

export default async function SinDetailPage({
  params,
}: PageProps<'/[locale]/sins/[slug]'>) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const tRank = await getTranslations('sinRank');

  let sin: Awaited<ReturnType<typeof getSin>>['data'] | null = null;
  try {
    const result = await getSin(slug, locale as LocaleCode);
    sin = result.data;
  } catch {
    notFound();
  }

  // Prefetch first page of quotes for instant hydration
  const queryClient = createQueryClient();
  const quotesParams = { page: 1, limit: 10 };
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.sins.quotes(slug, quotesParams),
      queryFn: () => getSinQuotes(slug, quotesParams),
    });
  } catch {
    // show loading state on client
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
        {sin && (
          <SinHeader
            sin={sin}
            rankLabel={sin.rank ? tRank(sin.rank) : undefined}
          />
        )}
        <ReminderList sinSlug={slug} />
      </div>
    </HydrationBoundary>
  );
}
