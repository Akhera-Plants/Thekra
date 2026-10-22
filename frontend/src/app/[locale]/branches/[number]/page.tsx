import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getBranch, getBranchQuotes } from '@/lib/api/branches';
import { ArabicText } from '@/components/shared/ArabicText';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { BranchReader } from '@/features/iman-branches/components/BranchReader';
import type { BranchQuotesMeta } from '@/lib/api/branches';

export const dynamic = 'force-dynamic';

export default async function BranchDetailPage({
  params,
}: PageProps<'/[locale]/branches/[number]'>) {
  const { number, locale } = await params;
  const branchNumber = Number(number);
  if (!Number.isInteger(branchNumber) || branchNumber < 1) notFound();

  setRequestLocale(locale);
  const t = await getTranslations('branches');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  let detail: Awaited<ReturnType<typeof getBranch>>['data'];
  try {
    detail = (await getBranch(branchNumber, locale)).data;
  } catch {
    notFound();
  }

  let branchQuotes: Awaited<ReturnType<typeof getBranchQuotes>> | null = null;
  try {
    branchQuotes = await getBranchQuotes(branchNumber, { limit: 50, lang: locale });
  } catch {
    branchQuotes = null;
  }

  const readerItems = (branchQuotes?.data.items ?? []).map((item) => ({
    id: item.quote.id,
    quote: item.quote,
    note: item.link.note,
  }));
  const countsByKind = (branchQuotes?.meta as BranchQuotesMeta | undefined)?.countsByKind;

  const heading = locale === 'en'
    ? (detail.title || t('branchFallback', { number: detail.number }))
    : detail.titleAr;

  return (
    <div className="page-width inner-page topic-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('branches'), href: '/branches' },
          { label: heading },
        ]}
      />

      <article className="flex min-w-0 flex-1 flex-col gap-10">
        <header className="page-heading">
          <p className="eyebrow">
            <FormattedNumber value={detail.number} />
          </p>
          <h1
            id="page-title"
            tabIndex={-1}
            lang={locale === 'en' ? undefined : 'ar'}
            dir={locale === 'en' ? undefined : 'rtl'}
          >
            {heading}
          </h1>
          {locale === 'en' && detail.title && detail.titleAr ? (
            <p dir="rtl" lang="ar" className="page-lead">{detail.titleAr}</p>
          ) : null}
          {locale === 'en' && detail.summary ? (
            <p className="page-lead">{detail.summary}</p>
          ) : detail.summaryAr ? (
            <p className="page-lead" dir="rtl" lang="ar">{detail.summaryAr}</p>
          ) : null}
        </header>

        {detail.explanations.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2>{t('explanations')}</h2>
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
          <div className="next-step">
            <p>{t('noQuotes')}</p>
            <p>{t('pending')}</p>
            <Link href="/branches" className="text-link">
              {tCrumbs('branches')}
            </Link>
          </div>
        ) : (
          <BranchReader
            number={branchNumber}
            lang={locale}
            items={readerItems}
            total={detail.quoteCount || readerItems.length}
            countsByKind={countsByKind}
          />
        )}

        <nav className="reader-end" aria-label={tCrumbs('branches')}>
          {detail.prev ? (
            <Link href={`/branches/${detail.prev.number}`} className="outline-button">
              {locale === 'en' && detail.prev.title ? (
                <span>{detail.prev.title}</span>
              ) : (
                <ArabicText as="span" size="sm">{detail.prev.titleAr}</ArabicText>
              )}
            </Link>
          ) : (
            <Link href="/branches" className="outline-button">
              {tCrumbs('branches')}
            </Link>
          )}
          {detail.next ? (
            <Link href={`/branches/${detail.next.number}`} className="solid-button">
              {locale === 'en' && detail.next.title ? (
                <span>{detail.next.title}</span>
              ) : (
                <ArabicText as="span" size="sm">{detail.next.titleAr}</ArabicText>
              )}
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
