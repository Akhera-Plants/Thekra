'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';

interface ServerErrorStateProps {
  /** `FailureKey` of the server-side failure, resolved on the server (the error object itself stays there). */
  kind?: 'network' | 'timeout' | 'server' | 'unknown';
  className?: string;
}

/**
 * For a server component that caught a failed fetch and still renders the rest of
 * the page. Retry re-requests this route (`router.refresh`) and shows the busy state meanwhile.
 */
export function ServerErrorState({ kind = 'unknown', className }: ServerErrorStateProps) {
  const t = useTranslations('feedback');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState
      message={pending ? t('retrying') : t(`error.${kind}`)}
      retryLabel={t('retry')}
      onRetry={pending ? undefined : () => startTransition(() => router.refresh())}
      className={className}
    />
  );
}
