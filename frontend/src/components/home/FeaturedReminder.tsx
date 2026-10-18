'use client';

import { Fragment } from 'react';
import { Bookmark, BookMarked, BookOpen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { useFavoriteQuoteIds } from '@/features/favorites/hooks/useFavoriteQuoteIds';
import { useToggleFavorite } from '@/features/favorites/hooks/useToggleFavorite';
import { formatDigits } from '@/lib/format/digits';
import { formatGradeCitation } from '@/lib/format/grade-citation';
import { englishProvenance } from '@/lib/format/provenance';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { splitChain } from './today/chain';

interface FeaturedReminderProps {
  quote: QuoteDto;
}

function EnglishWithHonorific({ text }: { text: string }) {
  const parts = text.split('ﷺ');
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <span lang="ar">ﷺ</span> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/** Selected reminder card matching thekra-source `.featured-reminder`. */
export function FeaturedReminder({ quote }: FeaturedReminderProps) {
  const t = useTranslations('home');
  const tFav = useTranslations('favorites');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { ids } = useFavoriteQuoteIds();
  const { toggle, isPending } = useToggleFavorite({
    labels: {
      added: tFav('added'),
      removed: tFav('removed'),
      error: tFav('error'),
      authRequired: tFav('authRequired'),
    },
  });

  const scripture = quote.type === QuoteType.HADITH || quote.type === QuoteType.QURAN_VERSE;
  const english = locale === 'en' && scripture ? (quote.translation?.text ?? null) : null;
  const { text } = splitChain(quote.textAr);
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const saved = ids.has(quote.id) || Boolean(quote.isFavorite);

  const sourceName =
    (locale === 'ar' ? quote.source?.nameAr : quote.source?.name)?.trim() ||
    (isQuran ? t('quranSource') : t('hadithSource'));

  const gradeLine = formatGradeCitation({
    locale,
    gradeAuthority: quote.citation?.gradeAuthority,
    gradeReference: quote.citation?.gradeReference,
    grade: quote.hadith?.grade,
  });
  const rawReference = quote.hadith?.reference?.trim()
    || (quote.quran?.surahNumber != null && quote.quran.ayahNumber != null
      ? t('verseCitation', {
          surah: (locale === 'ar' ? quote.quran.surahNameAr : quote.quran.surahName) ?? '',
          chapter: formatDigits(quote.quran.surahNumber),
          ayah: formatDigits(quote.quran.ayahNumber),
        })
      : null);
  const sourceLine =
    rawReference && locale === 'en'
      ? (englishProvenance(rawReference) ?? rawReference)
      : rawReference;
  const meta = [gradeLine, sourceLine].filter(Boolean).join(' · ');
  const body = english ?? text;

  return (
    <article className="featured-reminder">
      <div className="section-topline">
        <h2>{t('todayHeading')}</h2>
        <button
          type="button"
          className="icon-button save-button"
          aria-label={saved ? tFav('remove') : tFav('add')}
          aria-pressed={saved}
          disabled={isPending}
          onClick={() => toggle(quote.id, saved)}
        >
          <Bookmark className="size-[19px]" aria-hidden />
        </button>
      </div>
      <p className={isQuran ? 'quran featured-verse' : 'featured-verse'} lang={english ? 'en' : 'ar'}>
        {english ? <EnglishWithHonorific text={body} /> : body}
      </p>
      <div className="reading-bottom">
        <div className="source-stamp">
          {isQuran ? (
            <BookMarked className="size-6" aria-hidden />
          ) : (
            <BookOpen className="size-6" aria-hidden />
          )}
          <span>
            <strong>{sourceName}</strong>
            {meta ? <small>{formatDigits(meta)}</small> : null}
          </span>
        </div>
        <Link className="outline-button" href={`/quotes/${quote.id}`}>
          {t('readFull')} <DirectionalArrow className="size-[18px]" />
        </Link>
      </div>
    </article>
  );
}
