import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getBranches } from '@/lib/api/branches';
import { BRANCH_VOLUMES } from '@/lib/branch-volumes';
import { ArabicText } from '@/components/shared/ArabicText';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { EmptyState } from '@/components/shared/EmptyState';
import { SourceAttribution } from '@/components/shared/quote/SourceAttribution';
import { getBranchesHadith } from '@/lib/texts/edition';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BranchesPage({
  params,
}: PageProps<'/[locale]/branches'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('branches');
  const tQuote = await getTranslations('quote');

  let branches: Awaited<ReturnType<typeof getBranches>>['data'] = [];
  const [list, hadith] = await Promise.all([
    getBranches({ limit: 100, lang: locale }).catch(() => null),
    getBranchesHadith(),
  ]);
  branches = list?.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-10 px-4 py-12 md:px-8">
      <header className="flex max-w-prose flex-col gap-4">
        <h1 className="font-arabic-display text-4xl leading-tight lg:text-6xl">{t('pageTitle')}</h1>
        {hadith && (
          <div className="flex flex-col gap-3">
            <ArabicText size="lg">{hadith.textAr}</ArabicText>
            <SourceAttribution
              quote={hadith}
              labels={{
                narrator: tQuote('narrator'),
                reference: tQuote('reference'),
                source: tQuote('source'),
                volume: tQuote('volume'),
                page: tQuote('page'),
                gradeAuthority: tQuote('gradeAuthority'),
                gradeReference: tQuote('gradeReference'),
              }}
            />
          </div>
        )}
      </header>

      {branches.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <div className="flex flex-col gap-10">
          {BRANCH_VOLUMES.map((volume) => {
            const rows = branches.filter(
              (branch) => branch.number >= volume.from && branch.number <= volume.to,
            );
            if (rows.length === 0) return null;
            return (
              <section key={volume.volume} className="flex flex-col gap-2">
                <h2 className="flex items-baseline gap-3 border-b border-border pb-2 font-arabic-display text-lg text-muted-foreground">
                  <span>{t('volume')}</span>
                  <FormattedNumber value={volume.volume} />
                </h2>
                <ul className="md:columns-2 md:gap-x-12">
                  {rows.map((branch) => {
                    const quiet = branch.quoteCount === 0;
                    return (
                      <li key={branch.id} className="break-inside-avoid">
                        <Link
                          href={`/branches/${branch.number}`}
                          className={cn(
                            'flex min-h-16 min-w-0 items-baseline gap-3 border-b border-border py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-[transform,background-color] motion-safe:duration-200 motion-safe:hover:translate-x-1 motion-safe:hover:bg-muted/50 motion-safe:rtl:hover:-translate-x-1 motion-reduce:transition-none',
                            quiet && 'text-muted-foreground',
                          )}
                        >
                          <span className="w-10 shrink-0 font-arabic-display text-xl text-intent-iman-branch">
                            <FormattedNumber value={branch.number} />
                          </span>
                          <ArabicText
                            as="span"
                            face="display"
                            size="base"
                            className={cn('min-w-0 max-w-[70%]', quiet && 'text-muted-foreground')}
                          >
                            {branch.titleAr}
                          </ArabicText>
                          <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-border" />
                          <span className="shrink-0 text-sm text-muted-foreground">
                            <FormattedNumber value={branch.quoteCount} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
