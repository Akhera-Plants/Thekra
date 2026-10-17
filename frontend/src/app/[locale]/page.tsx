import { setRequestLocale } from 'next-intl/server';
import { BranchSky } from '@/components/home/branch-sky/BranchSky';
import { Bookshelf, type ShelfBook } from '@/components/home/bookshelf/Bookshelf';
import { DeedOfTheDay, type FeaturedDeed } from '@/components/home/deed-feature/DeedOfTheDay';
import { HeartIndex, type IndexTopic } from '@/components/home/heart-index/HeartIndex';
import { HeartSearch } from '@/components/home/heart-search/HeartSearch';
import { PathLinks } from '@/components/home/path-links/PathLinks';
import { TodayReminder } from '@/components/home/today/TodayReminder';
import { Verse } from '@/components/home/verse/Verse';
import { getBranches } from '@/lib/api/branches';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getReminderOfTheDay } from '@/lib/api/quotes';
import { getSins } from '@/lib/api/sins';
import { getCatalogSources, type CatalogSource } from '@/lib/api/sources';
import { utcDayNumber } from '@/lib/day';
import { getQafVerse } from '@/lib/texts/edition';
import type { GoodDeedDto, SinDto } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

const INDEX_SIZE = 12;
const CONTEMPORARY_SIZE = 6;

/** Ibn Kathir (Abridged) is imported for review but not shown to readers. */
function isHiddenSource(source: CatalogSource): boolean {
  return /ibn kathir/i.test(source.name) || /ابن كثير/.test(source.nameAr ?? '');
}

function topicName(
  topic: Pick<SinDto, 'name' | 'nameAr'> & { pair?: SinDto['pair'] },
  lang: 'ar' | 'en',
): string | null {
  if (topic.pair) return (lang === 'ar' ? topic.pair.titleAr : topic.pair.titleEn).trim() || null;
  const name = lang === 'ar' ? topic.nameAr : topic.name;
  return name?.trim() || null;
}

/** Topics ranked by their own texts. Contemporary topics borrow texts, so they get their own line. */
function pickTopics(sins: SinDto[], lang: 'ar' | 'en') {
  const topics: IndexTopic[] = [];
  const contemporary: Array<Pick<IndexTopic, 'slug' | 'name'>> = [];
  for (const sin of sins) {
    const name = topicName(sin, lang);
    if (!name) continue;
    if (sin.isContemporary) contemporary.push({ slug: sin.slug, name });
    else if (sin.quoteCount > 0) topics.push({ slug: sin.slug, name, count: sin.quoteCount });
  }
  topics.sort((a, b) => b.count - a.count);
  return { topics: topics.slice(0, INDEX_SIZE), contemporary: contemporary.slice(0, CONTEMPORARY_SIZE) };
}

/** Today's deed rotates through the published deeds that carry a reward line. */
function pickDeed(deeds: GoodDeedDto[], lang: 'ar' | 'en', day: number): FeaturedDeed | null {
  const published = deeds.filter((deed) => deed.quoteCount > 0 && topicName(deed, lang));
  const reward = (deed: GoodDeedDto) => (lang === 'ar' ? deed.rewardAr : deed.reward)?.trim() || null;
  const withReward = published.filter((deed) => reward(deed));
  const pool = (withReward.length > 0 ? withReward : published).toSorted((a, b) => a.slug.localeCompare(b.slug));
  const deed = pool[day % Math.max(pool.length, 1)];
  if (!deed) return null;
  const description = (lang === 'ar' ? deed.descriptionAr : deed.description)?.trim() || null;
  return {
    slug: deed.slug,
    name: topicName(deed, lang) ?? '',
    line: reward(deed) ?? description,
    count: deed.quoteCount,
  };
}

function pickBooks(sources: CatalogSource[], lang: 'ar' | 'en'): ShelfBook[] {
  const books: Array<ShelfBook & { quran: boolean }> = [];
  for (const source of sources) {
    const published = source.publishedQuoteCount ?? 0;
    if (published <= 0 || isHiddenSource(source)) continue;
    const title = (lang === 'ar' ? source.nameAr : source.name)?.trim();
    if (!title) continue;
    books.push({
      id: source.id,
      title,
      author: (lang === 'ar' ? source.authorAr : source.author)?.trim() || null,
      published,
      quran: source.type === 'QURAN',
    });
  }
  return books
    .toSorted((a, b) => Number(b.quran) - Number(a.quran) || b.published - a.published)
    .map((book) => ({ id: book.id, title: book.title, author: book.author, published: book.published }));
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'ar';

  const [verse, reminder, sins, deeds, branches, sources] = await Promise.all([
    getQafVerse(),
    getReminderOfTheDay(lang).then((result) => result.data).catch(() => null),
    getSins({ limit: 100, sort: 'quoteCount', lang }).then((result) => result.data).catch(() => []),
    getGoodDeeds({ limit: 100, sort: 'quoteCount', lang }).then((result) => result.data).catch(() => []),
    getBranches({ limit: 100, lang }).then((result) => result.data).catch(() => []),
    getCatalogSources({ limit: 100, lang }).then((result) => result.data).catch(() => []),
  ]);

  const day = utcDayNumber();
  const { topics, contemporary } = pickTopics(sins, lang);
  const deed = pickDeed(deeds, lang, day);
  const orderedBranches = branches.toSorted((a, b) => a.number - b.number);
  const todayBranch = orderedBranches[day % Math.max(orderedBranches.length, 1)] ?? null;
  const books = pickBooks(sources, lang);

  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      {/*
       * Above the fold (1440×900 and 390×844): search + paths.
       * The verse is small and secondary — brand inscription, not hero.
       * No page-specific colour script; the home page uses shared tokens only.
       */}
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 pt-[clamp(2rem,6vh,4.5rem)] pb-10 md:px-8">
        {/* Search — the primary action, prominent at top */}
        <HeartSearch />
        {/* Paths — the three doors into the content */}
        <PathLinks />
        {/* Verse — small inscription, brand anchor, secondary */}
        <div className="pt-2 w-full">
          <Verse verse={verse} locale={locale} />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-28 px-4 pb-32 md:gap-40 md:px-8">
        {reminder ? <TodayReminder quote={reminder} /> : null}
        <HeartIndex topics={topics} contemporary={contemporary} />
        {deed ? <DeedOfTheDay deed={deed} lang={lang} /> : null}
        {todayBranch ? (
          <BranchSky
            branches={orderedBranches}
            today={{
              number: todayBranch.number,
              title: (lang === 'ar' ? todayBranch.titleAr : todayBranch.title)?.trim() || null,
            }}
            lang={lang}
          />
        ) : null}
        <Bookshelf books={books} lang={lang} />
      </div>
    </div>
  );
}
