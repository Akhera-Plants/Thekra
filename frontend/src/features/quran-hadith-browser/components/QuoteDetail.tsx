'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { GradeBadge } from '@/components/shared/quote/GradeBadge';
import { QuoteBody } from '@/components/shared/quote/QuoteBody';
import { ReportMistake } from '@/components/shared/quote/ReportMistake';
import { SourceAttribution } from '@/components/shared/quote/SourceAttribution';
import { StudyPanel } from '@/features/study-panel/components/StudyPanel';
import type { QuoteDetailDto } from '@/lib/types/api';
import { HadithGrade } from '@/lib/types/enums';

interface QuoteDetailProps {
  quote: QuoteDetailDto;
}

/**
 * Full quote detail — used on /quotes/[id].
 * Server-rendered (revalidate: 3600) for SEO.
 */
export function QuoteDetail({ quote }: QuoteDetailProps) {
  const t = useTranslations('quote');
  const tDetail = useTranslations('quoteDetail');
  const arabic = useLocale() === 'ar';
  const [studyOpen, setStudyOpen] = useState(false);

  const grade = quote.hadith?.grade;
  const isWeak =
    grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU;
  const canStudy = quote.type === 'QURAN_VERSE' || quote.type === 'HADITH';

  return (
    <article className="flex flex-col gap-6">
      {/* Grade badge + type */}
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {t(`type.${
            quote.isAthar
              ? 'athar'
              : quote.type === 'QURAN_VERSE'
                ? 'quran'
                : quote.type === 'HADITH'
                  ? 'hadith'
                  : quote.type === 'SCHOLAR_QUOTE'
                    ? 'scholar'
                    : 'book'
          }`)}
        </Badge>
        {grade && grade !== HadithGrade.UNGRADED && !quote.isAthar && (
          <GradeBadge
            grade={grade}
            label={t(`grade.${grade.toLowerCase()}`)}
          />
        )}
      </header>

      {/* Weak notice */}
      {isWeak && (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground" role="note">
          {t('weakNotice')}
        </p>
      )}

      {quote.type === 'HADITH' && quote.hadith?.outsideSahihayn && (
        <p className="text-sm text-muted-foreground" role="note">{t('outsideSahihayn')}</p>
      )}

      <QuoteBody quote={quote}>
        {(quote.citation?.volume || quote.citation?.page || quote.citation?.gradeAuthority || quote.citation?.gradeReference || quote.book?.pageOrChapter) && (
          <a
            href={`#quote-${quote.id}-source`}
            className="ms-1 inline-block text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <sup>(<FormattedNumber value={1} />)</sup>
            <span className="sr-only">{t('citationMarker')}</span>
          </a>
        )}
      </QuoteBody>

      {canStudy ? (
        <Button
          type="button"
          variant="outline"
          tone="neutral"
          size="sm"
          className="self-start"
          onClick={() => setStudyOpen(true)}
        >
          {quote.type === 'QURAN_VERSE' ? t('openTafsir') : t('openSharh')}
        </Button>
      ) : null}

      <StudyPanel
        open={studyOpen}
        onOpenChange={setStudyOpen}
        quote={quote}
        listIds={[quote.id]}
      />

      <Separator />

      {/* Provenance */}
      <SourceAttribution
        quote={quote}
        citationAnchorId={`quote-${quote.id}-source`}
        labels={{
          narrator: t('narrator'),
          reference: t('reference'),
          source: t('source'),
          volume: t('volume'),
          page: t('page'),
          gradeAuthority: t('gradeAuthority'),
          gradeReference: t('gradeReference'),
        }}
      />

      {/* Tags */}
      {quote.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground me-1">
            {t('tags')}:
          </span>
          {quote.tags.filter((tag) => (arabic ? Boolean(tag.nameAr) : Boolean(tag.name || tag.nameAr))).map((tag) => (
            <Link key={tag.id} href={`/feelings/${tag.slug}`}>
              <Badge variant="secondary">
                {arabic || !tag.name ? (
                  tag.nameAr ? <span dir="rtl" lang="ar" className="font-arabic-ui">{tag.nameAr}</span> : null
                ) : (
                  tag.name
                )}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Related sins */}
      {quote.relatedSins && quote.relatedSins.length > 0 && (
        <section aria-labelledby="related-sins-heading">
          <h2 id="related-sins-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            {tDetail('relatedSins')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {quote.relatedSins.map((sin) => (
              <li key={sin.slug}>
                <Link href={`/sins/${sin.slug}`}>
                  <Badge variant="outline">
                    {arabic || !sin.name ? (
                      <span dir="rtl" lang="ar" className="font-arabic-ui">{sin.nameAr}</span>
                    ) : (
                      sin.name
                    )}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Related good deeds */}
      {quote.relatedGoodDeeds && quote.relatedGoodDeeds.length > 0 && (
        <section aria-labelledby="related-deeds-heading">
          <h2 id="related-deeds-heading" className="mb-2 text-sm font-semibold text-muted-foreground">
            {tDetail('relatedGoodDeeds')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {quote.relatedGoodDeeds.map((deed) => (
              <li key={deed.slug}>
                <Link href={`/good-deeds/${deed.slug}`}>
                  <Badge variant="outline">
                    {arabic || !deed.name ? (
                      <span dir="rtl" lang="ar" className="font-arabic-ui">{deed.nameAr}</span>
                    ) : (
                      deed.name
                    )}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {quote.type === 'HADITH' && <ReportMistake quoteId={quote.id} />}
    </article>
  );
}
