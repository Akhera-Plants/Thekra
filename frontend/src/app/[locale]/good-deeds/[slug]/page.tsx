import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getGoodDeed, getGoodDeedQuotes } from '@/lib/api/good-deeds';
import { createQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { LocaleCode } from '@/lib/types/enums';
import { GoodDeedHeader } from '@/features/good-deed-motivation/components/GoodDeedHeader';
import { RewardCallout } from '@/features/good-deed-motivation/components/RewardCallout';
import { OppositeSinLink } from '@/features/good-deed-motivation/components/OppositeSinLink';
import { MotivationList } from '@/features/good-deed-motivation/components/MotivationList';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/good-deeds/[slug]'>) {
  const { slug, locale } = await params;
  try {
    const { data } = await getGoodDeed(slug, locale as LocaleCode);
    return { title: `${data.nameAr} — ذكرى` };
  } catch {
    return {};
  }
}

export default async function GoodDeedDetailPage({
  params,
}: PageProps<'/[locale]/good-deeds/[slug]'>) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('goodDeedDetail');

  let goodDeed: Awaited<ReturnType<typeof getGoodDeed>>['data'] | null = null;
  try {
    const result = await getGoodDeed(slug, locale as LocaleCode);
    goodDeed = result.data;
  } catch {
    notFound();
  }

  const queryClient = createQueryClient();
  const quotesParams = { page: 1, limit: 10 };
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.goodDeeds.quotes(slug, quotesParams),
      queryFn: () => getGoodDeedQuotes(slug, quotesParams),
    });
  } catch {
    // show loading state on client
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
        {goodDeed && (
          <>
            <GoodDeedHeader goodDeed={goodDeed} />
            {goodDeed.rewardAr && (
              <RewardCallout
                rewardAr={goodDeed.rewardAr}
                reward={goodDeed.reward}
                heading={t('rewardHeading')}
              />
            )}
            {goodDeed.oppositeSin && (
              <OppositeSinLink
                oppositeSin={goodDeed.oppositeSin}
                label={t('oppositeSin')}
              />
            )}
          </>
        )}
        <MotivationList goodDeedSlug={slug} />
      </div>
    </HydrationBoundary>
  );
}
