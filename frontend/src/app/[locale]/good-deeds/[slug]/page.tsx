import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import type { ReaderItem, ReaderSection } from '@/components/shared/editorial/ReminderReader';
import { GoodDeedReader } from '@/features/good-deed-motivation/components/GoodDeedReader';
import { DeedHabits } from '@/features/practice/components/DeedHabits';
import { TOPIC_PAGE_SIZE, interleaveReading } from '@/lib/reading';
import { getGoodDeed, getGoodDeedQuotes, getGoodDeeds } from '@/lib/api/good-deeds';
import { rethrowUnlessNotFound, topSlugs } from '@/lib/api/server-guard';
import type { LocaleCode } from '@/lib/types/enums';
import type { GoodDeedQuotesMeta } from '@/lib/types/api';
import { localeAlternates, metaDescription } from '@/lib/seo';

// Same for every visitor: cached and revalidated, not rendered per request. The `?theme=` chip
// is applied on the client (useTopicReader), which is what keeps this page out of dynamic rendering.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await topSlugs('good-deeds', async () => (await getGoodDeeds({ limit: 100, lang: 'ar' })).data, (deed) => deed.slug);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/good-deeds/[slug]'>): Promise<Metadata> {
  const { slug, locale } = await params;
  try {
    const { data } = await getGoodDeed(slug, locale as LocaleCode);
    const title = data.pair
      ? (locale === 'en' ? data.pair.titleEn : data.pair.titleAr)
      : (locale === 'en' ? (data.name || data.nameAr) : data.nameAr);
    return {
      title,
      description: metaDescription(locale === 'en' ? data.description : data.descriptionAr),
      alternates: localeAlternates(locale, `/good-deeds/${slug}`),
    };
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
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  let deed: Awaited<ReturnType<typeof getGoodDeed>>['data'];
  try {
    deed = (await getGoodDeed(slug, locale as LocaleCode)).data;
  } catch (error) {
    rethrowUnlessNotFound('good-deed page', error);
  }

  const paired = Boolean(deed.pair);
  // See the sin page: fail rather than cache an empty reader.
  const quotes = await getGoodDeedQuotes(slug, {
    page: 1,
    limit: TOPIC_PAGE_SIZE,
    lang: locale as LocaleCode,
  }).catch((error: unknown) => rethrowUnlessNotFound('good-deed quotes', error));

  const toReader = (item: { quote: { id: string }; link: { note: string | null } }): ReaderItem => ({
    id: item.quote.id,
    quote: item.quote as ReaderItem['quote'],
    note: item.link.note,
  });
  const virtue = (quotes?.data.items ?? []).map(toReader);
  const seen = new Set(virtue.map((item) => item.id));
  const neglect = (quotes?.data.companion?.items ?? [])
    .map(toReader)
    .filter((item) => !seen.has(item.id));
  const derived = quotes?.data.derived ?? [];
  const quotesMeta = quotes?.meta as GoodDeedQuotesMeta | undefined;
  const activeTheme = quotesMeta?.theme ?? null;
  // A theme is one merged list (virtue and warning together), so it has no section headings.
  const sections: ReaderSection[] = activeTheme ? [] : [
    ...(virtue.length > 0
      ? [{ heading: paired ? t('pairVirtueHeading') : t('virtueHeading'), items: virtue, source: 'items' as const }]
      : []),
    ...(neglect.length > 0
      ? [{ heading: paired ? t('pairNeglectHeading') : t('neglectHeading'), items: neglect, source: 'companion' as const }]
      : []),
    ...derived.filter((group) => group.items.length > 0).map((group) => ({
      heading: locale === 'en' ? (group.name || group.nameAr) : group.nameAr,
      items: group.items.map(toReader),
    })),
  ];
  const items = interleaveReading(virtue, neglect).concat(derived.flatMap((group) => group.items.map(toReader)));
  const heading = paired
    ? (locale === 'en' ? deed.pair!.titleEn : deed.pair!.titleAr)
    : (locale === 'en' ? (deed.name || deed.nameAr) : deed.nameAr);
  // English shows the English description and reward or nothing: never Arabic prose on /en.
  const description = locale === 'en' ? deed.description : deed.descriptionAr;
  const reward = paired ? null : (locale === 'en' ? deed.reward : deed.rewardAr);
  const opposite = !paired && deed.oppositeSin
    ? (locale === 'en' ? (deed.oppositeSin.name || deed.oppositeSin.nameAr) : deed.oppositeSin.nameAr)
    : null;

  return (
    <div className="page-width inner-page topic-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('goodDeeds'), href: '/good-deeds' },
          { label: heading },
        ]}
      />

      <article className="flex min-w-0 flex-1 flex-col gap-10">
        <header className="page-heading">
          <p className="eyebrow">{tCrumbs('goodDeeds')}</p>
          <h1
            id="page-title"
            tabIndex={-1}
            lang={/[\u0600-\u06FF]/.test(heading) ? 'ar' : undefined}
            dir={/[\u0600-\u06FF]/.test(heading) ? 'rtl' : undefined}
          >
            {heading}
          </h1>
          {description ? <p className="page-lead">{description}</p> : null}
          {reward ? (
            <aside className="next-step" aria-label={t('rewardHeading')}>
              <strong>{t('rewardHeading')}</strong>
              {/[\u0600-\u06FF]/.test(reward) ? <ArabicText size="lg">{reward}</ArabicText> : <p>{reward}</p>}
            </aside>
          ) : null}
          {deed.schedule ? <DeedHabits habits={deed.schedule.habits} /> : null}
          {deed.branches && deed.branches.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {deed.branches.map((branch) => (
                <li key={branch.number} lang={locale === 'en' ? 'en' : 'ar'} dir={locale === 'en' ? 'ltr' : 'rtl'}>
                  {locale === 'en'
                    ? (branch.title || `Branch ${branch.number}`)
                    : branch.titleAr}
                </li>
              ))}
            </ul>
          ) : null}
          {deed.isContemporary ? (
            <p className="page-lead">{t('contemporaryNote')}</p>
          ) : null}
        </header>

        {items.length === 0 ? (
          <div className="next-step">
            <p>{t('noMotivations')}</p>
            <Link
              href={deed.oppositeSin ? `/sins/${deed.oppositeSin.slug}` : '/good-deeds'}
              className="text-link"
            >
              {opposite ? (
                <span lang={/[\u0600-\u06FF]/.test(opposite) ? 'ar' : undefined} dir={/[\u0600-\u06FF]/.test(opposite) ? 'rtl' : undefined}>
                  {opposite}
                </span>
              ) : (
                tCrumbs('goodDeeds')
              )}
            </Link>
          </div>
        ) : (
          <GoodDeedReader
            slug={slug}
            lang={locale}
            items={items}
            sections={sections}
            total={items.length}
            countsByKind={quotesMeta?.countsByKind}
            themes={quotesMeta?.themes}
            initialTheme={activeTheme}
          initialHasNext={quotesMeta?.hasNext ?? false}
          />
        )}

        {deed.oppositeSin && opposite ? (
          <p className="page-footnote">
            <Link href={`/sins/${deed.oppositeSin.slug}`} className="text-link">
              <span lang={/[\u0600-\u06FF]/.test(opposite) ? 'ar' : undefined} dir={/[\u0600-\u06FF]/.test(opposite) ? 'rtl' : undefined}>
                {opposite}
              </span>
            </Link>
          </p>
        ) : null}
      </article>
    </div>
  );
}
