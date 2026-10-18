import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { QuoteDto } from '@/lib/types/api';

interface ReflectionProps {
  quote: QuoteDto;
  locale: 'ar' | 'en';
}

export async function Reflection({ quote, locale }: ReflectionProps) {
  const t = await getTranslations('home');
  const text = (locale === 'en' ? quote.translation?.text : null) ?? quote.textAr;
  const author =
    (locale === 'ar' ? quote.source?.authorAr : quote.source?.author)?.trim()
    || (locale === 'ar' ? quote.source?.nameAr : quote.source?.name)?.trim()
    || t('reflectionAuthorFallback');
  const work = (locale === 'ar' ? quote.source?.nameAr : quote.source?.name)?.trim();

  return (
    <section className="reflection-section" aria-labelledby="reflection-title">
      <div className="reflection-label">
        <span className="ornament" aria-hidden>
          ✳
        </span>
        <h2 id="reflection-title">{t('reflectionHeading')}</h2>
      </div>
      <div className="reflection-body">
        <blockquote lang={locale === 'en' && quote.translation?.text ? 'en' : 'ar'}>{text}</blockquote>
        <div className="reflection-details">
          <p>
            <strong>{author}</strong>
            {work ? <span>{work}</span> : null}
          </p>
          <Link className="outline-button" href={`/quotes/${quote.id}`}>
            {t('reflectionCta')} <ArrowLeft className="size-[18px] rtl:-scale-x-100" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
