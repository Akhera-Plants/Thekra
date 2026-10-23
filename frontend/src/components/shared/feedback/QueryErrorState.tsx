'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/ErrorState';
import { failureKey, isRetryable } from '@/lib/errors';

interface QueryErrorStateProps {
  /** The error from a query/mutation (an `ApiError` in practice). Never rendered as text. */
  error: unknown;
  /** Re-run the failed request, e.g. `() => void query.refetch()`. Omit when retrying would repeat. */
  onRetry?: () => void;
  /** Overrides the default per-kind message (e.g. «تعذّر تحميل النص»). */
  message?: string;
  className?: string;
}

/**
 * The one way a failed client request is shown: localised message by failure
 * kind plus a retry button. No raw error text, URLs or status codes reach the
 * visitor; the query cache has already logged the details to the console.
 */
export function QueryErrorState({ error, onRetry, message, className }: QueryErrorStateProps) {
  const t = useTranslations('feedback');
  return (
    <ErrorState
      message={message ?? t(`error.${failureKey(error)}`)}
      retryLabel={t('retry')}
      onRetry={isRetryable(error) ? onRetry : undefined}
      className={className}
    />
  );
}
