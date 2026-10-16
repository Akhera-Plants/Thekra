import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getBranch, getBranchQuotes } from '@/lib/api/branches';
import { ArabicText } from '@/components/shared/ArabicText';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { ReminderReader } from '@/components/shared/editorial/ReminderReader';

export const dynamic = 'force-dynamic';

export default async function BranchDetailPage({
  params,
}: PageProps<'/[locale]/branches/[number]'>) {
  const { number, locale } = await params;
  const branchNumber = Number(number);
  if (!Number.isInteger(branchNumber) || branchNumber < 1) notFound();

  setRequestLocale(locale);
  const t = await getTranslations('branches');
  const tDetail = await getTranslations('sinDetail');

  let detail: Awaited<ReturnType<typeof getBranch>>['data'];
  try {
    detail = (await getBranch(branchNumber, locale)).data;
  } catch {
    notFound();
  }

  let items: Awaited<ReturnType<typeof getBranchQuotes>>['data']['items'] = [];
  try {
    items = (await getBranchQuotes(branchNumber, { limit: 20, lang: locale })).data.items;
  } catch {
    items = [];
  }

  const readerItems = items.map((item) => ({
    id: item.quote.id,
    quote: item.quote,
    note: item.link.note,
  }));

  return (
    <article className="mx-auto flex w-full max-w-prose min-w-0 flex-1 flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
      <header className="flex flex-col gap-3">
        <p className="font-arabic-display text-2xl text-intent-iman-branch">
          <FormattedNumber value={detail.number} />
        </p>
        {locale === 'en' ? (
          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            {detail.title || t('branchFallback', { number: detail.number })}
          </h1>
        ) : (
          <ArabicText as="h1" face="display" size="xl" className="text-4xl lg:text-5xl">
            {detail.titleAr}
          </ArabicText>
        )}
        {locale === 'en' && detail.title && detail.titleAr ? (
          <p dir="rtl" lang="ar" className="font-arabic-ui text-sm text-muted-foreground">{detail.titleAr}</p>
        ) : null}
        {locale === 'en' && detail.summary ? (
          <p className="text-muted-foreground">{detail.summary}</p>
        ) : detail.summaryAr ? (
          <ArabicText size="base" className="text-muted-foreground">
            {detail.summaryAr}
          </ArabicText>
        ) : null}
      </header>

      {detail.explanations.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-arabic-display text-xl">{t('explanations')}</h2>
          <ul className="flex flex-col gap-4">
            {detail.explanations.map((item) => (
              <li key={item.id}>
                <ArabicText size="base">{item.text}</ArabicText>
              </li>
            ))}
          </ul>
        </section>
      )}

      {readerItems.length === 0 ? (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p>{t('noQuotes')}</p>
          <p className="text-sm text-muted-foreground">{t('pending')}</p>
          <Link
            href="/browse"
            className="inline-flex min-h-11 w-fit items-center border-b border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tDetail('browse')}
          </Link>
        </div>
      ) : (
        <ReminderReader
          items={readerItems}
          total={detail.quoteCount || readerItems.length}
          intent="iman-branch"
          labels={{
            another: tDetail('anotherReminder'),
            previous: tDetail('previous'),
            next: tDetail('next'),
            showAll: tDetail('showAll'),
            showOne: tDetail('showOne'),
            of: tDetail('of'),
          }}
        />
      )}

      <div className="flex justify-between gap-4 border-t border-border pt-6 text-sm">
        {detail.prev ? (
          <Link
            href={`/branches/${detail.prev.number}`}
            className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {locale === 'en' && detail.prev.title ? (
              <span className="text-sm">{detail.prev.title}</span>
            ) : (
              <ArabicText as="span" size="sm">{detail.prev.titleAr}</ArabicText>
            )}
          </Link>
        ) : (
          <span />
        )}
        {detail.next ? (
          <Link
            href={`/branches/${detail.next.number}`}
            className="min-w-0 text-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {locale === 'en' && detail.next.title ? (
              <span className="text-sm">{detail.next.title}</span>
            ) : (
              <ArabicText as="span" size="sm">{detail.next.titleAr}</ArabicText>
            )}
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}
