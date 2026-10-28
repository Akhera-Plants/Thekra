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
}

/** The texts behind a habit or a program step, from the database, with the shared quote card. */
export function EvidenceQuotes({ ids, quotes }: EvidenceQuotesProps) {
  const t = useTranslations('practice.evidence');
  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  const shown = ids.flatMap((id) => byId.get(id) ?? []);
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{t('none')}</p>;
  return (
    <ul className="flex flex-col gap-4">
      {shown.map((quote) => (
        <li key={quote.id}>
          <QuoteCard quote={quote} density="compact" intent="good-deed" />
        </li>
      ))}
    </ul>
  );
}

interface FetchedEvidenceProps {
  ids: readonly string[];
}

/** Fetches the published texts for `ids` and shows them (loading, error with retry, empty). */
export function FetchedEvidence({ ids }: FetchedEvidenceProps) {
  const t = useTranslations('practice.evidence');
  const query = usePracticeEvidence(ids);
  if (query.isPending) return <BrandLoader label={t('loading')} showLabel />;
  if (query.isError) return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />;
  return <EvidenceQuotes ids={ids} quotes={query.data} />;
}
