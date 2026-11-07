'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { QuoteCard } from '@/components/shared/quote';
import type { QuoteDto } from '@/lib/types/api';
import { usePracticeEvidence } from '../hooks/usePracticeEvidence';

interface EvidenceQuotesProps {
  ids: readonly string[];
  /** Quotes already fetched (a larger set); the ones in `ids` are shown in `ids` order. */
  quotes: readonly QuoteDto[];
  /** The heading that ties the texts to the habit or sin (O-05/F-04), e.g. «آيات وأحاديث تعينك على هذه الطاعة». */
  heading?: string;
  /** Under the heading: the habit's or sin's name. */
  subject?: string;
}

function EvidenceHeading({ heading, subject }: { heading?: string; subject?: string }) {
  if (!heading) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-lg font-semibold leading-snug">{heading}</h3>
      {subject ? <p className="text-sm text-muted-foreground">{subject}</p> : null}
    </div>
  );
}

/** The texts behind a habit or a program step, from the database, with the shared quote card. */
export function EvidenceQuotes({ ids, quotes, heading, subject }: EvidenceQuotesProps) {
  const t = useTranslations('practice.evidence');
  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  const shown = ids.flatMap((id) => byId.get(id) ?? []);
  return (
    <div className="flex flex-col gap-3">
      <EvidenceHeading heading={heading} subject={subject} />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((quote) => (
            <li key={quote.id}>
              <QuoteCard quote={quote} density="compact" intent="good-deed" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FetchedEvidenceProps {
  ids: readonly string[];
  heading?: string;
  subject?: string;
}

/** Fetches the published texts for `ids` and shows them (loading, error with retry, empty). */
export function FetchedEvidence({ ids, heading, subject }: FetchedEvidenceProps) {
  const t = useTranslations('practice.evidence');
  const query = usePracticeEvidence(ids);
  if (query.isPending) return <BrandLoader label={t('loading')} showLabel />;
  if (query.isError) return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />;
  return <EvidenceQuotes ids={ids} quotes={query.data} heading={heading} subject={subject} />;
}
