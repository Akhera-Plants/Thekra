import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HeartSearch } from '@/components/home/heart-search/HeartSearch';
import { PathLinks } from '@/components/home/path-links/PathLinks';
import { TodayReminder } from '@/components/home/today/TodayReminder';
import { Verse } from '@/components/home/verse/Verse';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { getBranches } from '@/lib/api/branches';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getReminderOfTheDay } from '@/lib/api/quotes';
import { getSins } from '@/lib/api/sins';
import { getCatalogSources } from '@/lib/api/sources';
import { BRANCH_VOLUMES } from '@/lib/branch-volumes';
import { reminderWord, utcDayNumber } from '@/lib/day';
import { getQafVerse } from '@/lib/texts/edition';
import type { LocaleCode } from '@/lib/types/enums';

export const dynamic = 'force-dynamic';

const CLOTH = ['book-cloth-a', 'book-cloth-b', 'book-cloth-c'] as const;

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as LocaleCode;
  const t = await getTranslations('home');
  const tAbout = await getTranslations('about');

  const [verse, reminder, sins, deeds, branches, sources] = await Promise.all([
    getQafVerse(),
    getReminderOfTheDay(lang).then((result) => result.data).catch(() => null),
    getSins({ limit: 100, sort: 'quoteCount', lang }).then((result) => result.data).catch(() => []),
    getGoodDeeds({ limit: 100, sort: 'quoteCount', lang }).then((result) => result.data).catch(() => []),
    getBranches({ limit: 100, lang }).then((result) => result.data).catch(() => []),
    getCatalogSources({ limit: 100, lang }).then((result) => result.data).catch(() => []),
  ]);

  const heavy = sins.filter((sin) => sin.quoteCount > 0).slice(0, 8);
  const publishedDeeds = deeds
    .filter((deed) => deed.quoteCount > 0)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const day = utcDayNumber();
  const deed = publishedDeeds.length > 0 ? publishedDeeds[day % publishedDeeds.length] : null;
  const reward = deed ? (locale === 'ar' ? deed.rewardAr : deed.reward) : null;
  const orderedBranches = branches.slice().sort((a, b) => a.number - b.number);
  const todayBranch = orderedBranches.length > 0 ? orderedBranches[day % orderedBranches.length] : null;
  const books = sources.filter((source) => (locale === 'ar' ? source.nameAr : source.name));

  return (
    <div className="flex flex-1 flex-col">
      <script
        dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.sky='home'" }}
      />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8 md:py-12">
        <Verse verse={verse} brand={t('title')} />
        <div className="flex flex-col gap-5">
          <HeartSearch />
          <PathLinks />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-16 md:gap-28 md:px-8 md:py-24">
        {reminder ? <TodayReminder quote={reminder} /> : null}

        {heavy.length > 0 ? (
          <section className="flex flex-col gap-6">
            <h2 className="font-arabic-display text-3xl leading-tight md:text-4xl">{t('heavyHeading')}</h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {heavy.map((sin) => (
                <li key={sin.id}>
                  <Link
                    href={`/sins/${sin.slug}`}
                    className="home-press flex min-h-28 flex-col justify-between rounded-xl bg-foreground/6 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-arabic-display text-2xl leading-snug">{sin.nameAr}</span>
                    <span className="text-sm text-muted-foreground">
                      <FormattedNumber value={sin.quoteCount} />{' '}
                      {locale === 'ar' ? reminderWord(sin.quoteCount) : 'reminders'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {deed ? (
          <section className="flex max-w-prose flex-col gap-4">
            <h2 className="font-arabic-display text-3xl leading-tight md:text-4xl">{t('deedHeading')}</h2>
            <Link
              href={`/good-deeds/${deed.slug}`}
              className="home-press flex flex-col gap-3 rounded-xl bg-foreground/6 px-5 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-arabic-display text-3xl leading-snug">{deed.nameAr}</span>
              {reward ? <span className="text-base leading-relaxed text-muted-foreground">{reward}</span> : null}
            </Link>
          </section>
        ) : null}

        {orderedBranches.length > 0 && todayBranch ? (
          <section className="flex flex-col gap-8">
            <h2 className="font-arabic-display text-3xl leading-tight md:text-4xl">{t('branchesHeading')}</h2>
            <Link
              href={`/branches/${todayBranch.number}`}
              className="home-press max-w-prose font-arabic-display text-2xl leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-3xl"
            >
              {t('branchToday')} <FormattedNumber value={todayBranch.number} />
              <span className="ms-3">{todayBranch.titleAr}</span>
            </Link>
            <div className="flex flex-col gap-6">
              {BRANCH_VOLUMES.map((volume) => {
                const rows = orderedBranches.filter(
                  (branch) => branch.number >= volume.from && branch.number <= volume.to,
                );
                if (rows.length === 0) return null;
                return (
                  <div key={volume.volume} className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t('volumeLabel')} <FormattedNumber value={volume.volume} />
                    </p>
                    <ol className="flex flex-wrap gap-1.5">
                      {rows.map((branch) => {
                        const today = branch.number === todayBranch.number;
                        return (
                          <li key={branch.id}>
                            <Link
                              href={`/branches/${branch.number}`}
                              aria-current={today ? 'true' : undefined}
                              className={
                                today
                                  ? 'home-press inline-flex size-11 items-center justify-center rounded-lg bg-foreground text-sm text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                  : 'home-press inline-flex size-11 items-center justify-center rounded-lg text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                              }
                            >
                              <FormattedNumber value={branch.number} />
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {books.length > 0 ? (
          <section className="flex flex-col gap-6">
            <h2 className="font-arabic-display text-3xl leading-tight md:text-4xl">{t('sourcesHeading')}</h2>
            <ul className="flex flex-wrap items-end gap-4">
              {books.map((book, index) => {
                const title = locale === 'ar' ? book.nameAr : book.name;
                const author = locale === 'ar' ? book.authorAr : book.author;
                const imported = book.quoteCount ?? 0;
                const published = book.publishedQuoteCount ?? 0;
                return (
                  <li key={book.id}>
                    <Link
                      href="/about"
                      className={`home-press flex w-36 items-stretch overflow-hidden rounded-sm text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${CLOTH[index % CLOTH.length]}`}
                      style={{ minHeight: `${11 + (index % 3) * 1.15}rem` }}
                    >
                      <span className="w-2 shrink-0 bg-black/25" aria-hidden />
                      <span className="flex flex-1 flex-col justify-between px-3 py-3">
                      <span className="font-arabic-display text-lg leading-snug">{title}</span>
                      <span className="flex flex-col gap-1 text-sm leading-snug opacity-80">
                        {author ? <span>{author}</span> : null}
                        <span>
                          <FormattedNumber value={imported} /> {tAbout('imported')}
                          {' · '}
                          <FormattedNumber value={published} /> {tAbout('published')}
                        </span>
                      </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
