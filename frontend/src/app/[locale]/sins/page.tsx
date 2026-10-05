import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getSins } from '@/lib/api/sins';
import { createQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { SinList } from '@/features/sin-reminder/components/SinList';

// Force dynamic so the build succeeds without the API running
export const dynamic = 'force-dynamic';

export default async function SinsPage({
  params,
}: PageProps<'/[locale]/sins'>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('sins');

  const queryClient = createQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.sins.list({}),
      queryFn: () => getSins({ limit: 200 }),
    });
  } catch {
    // API down during build/test — show empty state on client
  }

  const sinsData = queryClient.getQueryData<{ data: Awaited<ReturnType<typeof getSins>>['data'] }>(
    queryKeys.sins.list({ limit: 200 }),
  );
  const sins = (sinsData as Awaited<ReturnType<typeof getSins>> | undefined)?.data ?? [];

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold md:text-3xl">{t('pageTitle')}</h1>
        <SinList sins={sins} />
      </div>
    </HydrationBoundary>
  );
}
