import { Sprout } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { HomeWirdCard } from '@/features/practice/components/hub/HomeWirdCard';
import { formatDigits } from '@/lib/format/digits';
import type { QuoteDto } from '@/lib/types/api';

interface HomeHeroProps {
  /** Qaf 50:37 as stored (content rule §3.1: Quran text only from the database); null when the API did not answer. */
  verse: QuoteDto | null;
  locale: 'ar' | 'en';
}

/**
 * The home's opening (redesign §0, §2): the verse the app is named after (﴿إن في ذلك لذكرى لمن كان له قلب…﴾, ق 37),
 * one line on the aim, «ابدأ بغرسٍ صغير» (opens «أضف» on «ورد اليوم»), and, for a device with habits, the small
 * «بقي عليك اليوم n · المداومة N» card.
 */
export async function HomeHero({ verse, locale }: HomeHeroProps) {
  const t = await getTranslations('home');
  const surah = verse?.quran ? (locale === 'ar' ? verse.quran.surahNameAr : verse.quran.surahName) : null;
  const english = locale === 'en' ? (verse?.translation?.text?.trim() ?? null) : null;

  return (
    <section className="flex flex-col items-center gap-5 pt-10 pb-2 text-center sm:pt-14" aria-labelledby="home-aim">
      {verse ? (
        <figure className="flex max-w-3xl flex-col items-center gap-2">
          <blockquote lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.1] text-foreground sm:text-3xl">
            ﴿{verse.textAr}﴾
          </blockquote>
          {english ? <p className="text-base leading-8 text-muted-foreground">{english}</p> : null}
          {surah && verse.quran?.ayahNumber != null ? (
            <figcaption className="text-sm text-muted-foreground">
              {t('verseCitation', {
                surah,
                chapter: formatDigits(verse.quran.surahNumber ?? 50),
                ayah: formatDigits(verse.quran.ayahNumber),
              })}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <h1 id="home-aim" className="max-w-2xl text-xl leading-9 font-medium sm:text-2xl">
        {t('aim')}
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link className="solid-button" href={{ pathname: '/practice', query: { add: '1' } }}>
          <Sprout aria-hidden />
          {t('startCta')} <DirectionalArrow className="size-[18px]" />
        </Link>
        <HomeWirdCard />
      </div>
    </section>
  );
}
