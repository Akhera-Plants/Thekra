import { setRequestLocale } from 'next-intl/server';
import { FeaturedDeed } from '@/components/home/FeaturedDeed';
import { FeaturedReminder } from '@/components/home/FeaturedReminder';
import { Moments } from '@/components/home/Moments';
import { OrnamentalDivider } from '@/components/home/OrnamentalDivider';
import { Pathways } from '@/components/home/Pathways';
import { Reflection } from '@/components/home/Reflection';
import { SourceStrip } from '@/components/home/SourceStrip';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { getQuotes, getReminderOfTheDay } from '@/lib/api/quotes';
import { utcDayNumber } from '@/lib/day';
import { QuoteType } from '@/lib/types/enums';
import type { GoodDeedDto, QuoteDto } from '@/lib/types/api';

export const dynamic = 'force-dynamic';

function topicName(
  topic: Pick<GoodDeedDto, 'name' | 'nameAr'> & { pair?: GoodDeedDto['pair'] },
  lang: 'ar' | 'en',
): string | null {
  if (topic.pair) return (lang === 'ar' ? topic.pair.titleAr : topic.pair.titleEn).trim() || null;
  const name = lang === 'ar' ? topic.nameAr : topic.name;
  return name?.trim() || null;
}

/** Today's deed rotates through published deeds that carry a reward line. Prefer parents when present. */
function pickDeed(deeds: GoodDeedDto[], lang: 'ar' | 'en', day: number) {
  const preferred = deeds.find((d) => d.slug === 'birr-al-walidayn' && d.quoteCount > 0);
  if (preferred) {
    const description = (lang === 'ar' ? preferred.descriptionAr : preferred.description)?.trim() || null;
    const reward = (lang === 'ar' ? preferred.rewardAr : preferred.reward)?.trim() || null;
    return {
      slug: preferred.slug,
      name: topicName(preferred, lang) ?? '',
      line: reward ?? description,
    };
  }

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
  const day = utcDayNumber();

  const [reminder, deeds, scholars] = await Promise.all([
    getReminderOfTheDay(lang)
      .then((result) => result.data)
      .catch(() => null),
    getGoodDeeds({ limit: 100, sort: 'quoteCount', lang })
      .then((result) => result.data)
      .catch(() => []),
    getQuotes({ type: [QuoteType.SCHOLAR_QUOTE], limit: 12, lang })
      .then((result) => result.data)
      .catch(() => []),
  ]);

  const deed = pickDeed(deeds, lang, day);
  const reflection = pickReflection(scholars, day);

  return (
    <div className="page-width flex flex-1 flex-col pb-10">
      <Pathways />
      <OrnamentalDivider />
      <Moments />
      <section className="reading-pair" aria-label={lang === 'ar' ? 'تذكرة وباب من الخير' : 'Reminder and a door to good'}>
        {reminder ? <FeaturedReminder quote={reminder} /> : null}
        {deed ? <FeaturedDeed deed={deed} /> : null}
      </section>
      {reflection ? <Reflection quote={reflection} locale={lang} /> : null}
      <SourceStrip locale={lang} />
    </div>
  );
}
