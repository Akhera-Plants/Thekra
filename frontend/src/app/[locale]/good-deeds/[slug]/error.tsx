'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/ErrorState';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GoodDeedDetailError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useTranslations('errorState');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-10">
      <ErrorState
        message={t('default')}
        retryLabel={t('retry')}
        onRetry={reset}
      />
    </div>
  );
}
