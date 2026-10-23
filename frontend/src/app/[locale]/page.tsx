import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeaturedDeed } from '@/components/home/FeaturedDeed';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { Moments } from '@/components/home/Moments';
import { OrnamentalDivider } from '@/components/home/OrnamentalDivider';
import { Pathways } from '@/components/home/Pathways';
import { Reflection } from '@/components/home/Reflection';
import { SourceStrip } from '@/components/home/SourceStrip';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getQuotes, getReminderOfTheDay } from '@/lib/api/quotes';
import { reportFailure } from '@/lib/errors';
import { getSourceStripNames } from '@/lib/api/source-strip';
import { utcDayNumber } from '@/lib/day';
import { QuoteType } from '@/lib/types/enums';
import type { GoodDeedDto, QuoteDto } from '@/lib/types/api';
import { localeAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  // absolute: the home title is the brand line, not a topic, so no template suffix.
  return {
    title: { absolute: `${t('name')} — ${t('tagline')}` },
    alternates: localeAlternates(locale, '/'),
  };
}

// Public and the same for everyone: cached, rebuilt at most every 5 minutes. The «today» picks
// derive from the UTC day, so they roll over within one revalidation window.
export const revalidate = 300;

type Settled<T> = { ok: true; value: T } | { ok: false };
const ok = <T,>(value: T): Settled<T> => ({ ok: true, value });
const failed = (scope: string) => (error: unknown): Settled<never> => {
  reportFailure(scope, error);
  return { ok: false };
};

function topicName(
  topic: Pick<GoodDeedDto, 'name' | 'nameAr'> & { pair?: GoodDeedDto['pair'] },
  lang: 'ar' | 'en',
): string | null {
  if (topic.pair) return (lang === 'ar' ? topic.pair.titleAr : topic.pair.titleEn).trim() || null;
  const name = lang === 'ar' ? topic.nameAr : topic.name;
  return name?.trim() || null;
}

/** Today's deed rotates through published deeds that carry a reward line. */
function pickDeed(deeds: GoodDeedDto[], lang: 'ar' | 'en', day: number) {
  const published = deeds.filter((deed) => deed.quoteCount > 0 && topicName(deed, lang));
  const reward = (deed: GoodDeedDto) => (lang === 'ar' ? deed.rewardAr : deed.reward)?.trim() || null;
  const withReward = published.filter((deed) => reward(deed));
  const pool = (withReward.length > 0 ? withReward : published).toSorted((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  const deed = pool[day % Math.max(pool.length, 1)];
  if (!deed) return null;
  const description = (lang === 'ar' ? deed.descriptionAr : deed.description)?.trim() || null;
  return {
    slug: deed.slug,
    name: topicName(deed, lang) ?? '',
    line: reward(deed) ?? description,
  };
}

function pickReflection(quotes: QuoteDto[], day: number): QuoteDto | null {
  if (quotes.length === 0) return null;
  return quotes[day % quotes.length] ?? null;
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'ar';
  const t = await getTranslations('home');
  const day = utcDayNumber();

  const [reminderResult, deedsResult, scholarsResult, sourceNames] = await Promise.all([
    getReminderOfTheDay(lang).then((result) => result.data).then(ok, failed('home reminder')),
    getGoodDeeds({ limit: 100, sort: 'quoteCount', lang }).then((result) => result.data).then(ok, failed('home deeds')),
    getQuotes({ type: [QuoteType.SCHOLAR_QUOTE], limit: 12, lang }).then((result) => result.data).then(ok, failed('home reflections')),
    getSourceStripNames(lang),
  ]);
  // Each block is optional, but with all three down the API is unreachable: show the retry
  // (error.tsx) instead of caching a bare page for everyone.
  if (!reminderResult.ok && !deedsResult.ok && !scholarsResult.ok) {
    throw new Error('Home page: every data source failed');
  }
  const reminder = reminderResult.ok ? reminderResult.value : null;
  const deeds = deedsResult.ok ? deedsResult.value : [];
  const scholars = scholarsResult.ok ? scholarsResult.value : [];

  const deed = pickDeed(deeds, lang, day);
  const reflection = pickReflection(scholars, day);

  return (
    <div className="page-width flex flex-1 flex-col pb-10">
      <Pathways />
      <OrnamentalDivider />
      <Moments />
      {(reminder || deed) ? (
        <section className="reading-pair" aria-label={t('readingPairLabel')}>
          {reminder ? <FeaturedReminder quote={reminder} /> : null}
          {deed ? <FeaturedDeed deed={deed} /> : null}
        </section>
      ) : null}
      {reflection ? <Reflection quote={reflection} locale={lang} /> : null}
      <SourceStrip locale={lang} names={sourceNames} />
    </div>
  );
}
