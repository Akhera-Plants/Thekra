import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { createQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { GoodDeedList } from '@/features/good-deed-motivation/components/GoodDeedList';

export const dynamic = 'force-dynamic';

export default async function GoodDeedsPage({
  params,
}: PageProps<'/[locale]/good-deeds'>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('goodDeeds');

  const queryClient = createQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.goodDeeds.list({ limit: 100 }),
      queryFn: () => getGoodDeeds({ limit: 100 }),
    });
  } catch {
    // API down during build/test
  }

  const deedsData = queryClient.getQueryData<Awaited<ReturnType<typeof getGoodDeeds>>>(
    queryKeys.goodDeeds.list({ limit: 100 }),
  );
  const goodDeeds = (deedsData as Awaited<ReturnType<typeof getGoodDeeds>> | undefined)?.data ?? [];

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold md:text-3xl">{t('pageTitle')}</h1>
        <GoodDeedList goodDeeds={goodDeeds} />
      </div>
    </HydrationBoundary>
  );
}
