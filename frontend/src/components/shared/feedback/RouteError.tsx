'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/ErrorState';
import { reportFailure } from '@/lib/errors';

interface RouteErrorProps {
  error: Error & { digest?: string };
  /** `retry` from the `error.tsx` props: re-fetches and re-renders the segment. */
  retry: () => void;
}

/**
 * Body of every `error.tsx`. A server error reaches the browser as a bare `Error`
 * with only a digest (details stay in the server log), so the message is the
 * generic localised one; the digest is logged so the two can be matched.
 */
export function RouteError({ error, retry }: RouteErrorProps) {
  const t = useTranslations('feedback');

  useEffect(() => {
    reportFailure(`route${error.digest ? ` (digest ${error.digest})` : ''}`, error);
  }, [error]);

  return (
    <div className="page-width inner-page flex flex-1 items-center justify-center">
      <ErrorState message={t('error.unknown')} retryLabel={t('retry')} onRetry={retry} />
    </div>
  );
}
