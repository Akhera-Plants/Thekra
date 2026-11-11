'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from './BrandLoader';
import { QueryErrorState } from './QueryErrorState';

interface ReaderStatusProps {
  /** A new filter is loading: the list below stays on screen, dimmed. */
  busy: boolean;
  /** The first page of the current filter failed (the list below is empty). */
  failed: boolean;
  /** «Show more» failed (the list below is still valid). */
  nextPageFailed?: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * Reports a reader list's loading and failure without moving anything:
 * - loading: a pill pinned to the bottom of the viewport (it appears after a short delay, so
 *   quick answers show nothing); the tabs and chips stay live and the list is dimmed by ReminderReader;
 * - failure: an error with retry, rendered after the list (which is empty on a failed first page).
 */
export function ReaderStatus({ busy, failed, nextPageFailed = false, error, onRetry }: ReaderStatusProps) {
  const t = useTranslations('feedback');
  return (
    <>
      <div className="list-pending-pill" data-active={busy && !failed} aria-live="polite">
        {busy && !failed ? <BrandLoader label={t('loadingList')} showLabel /> : null}
      </div>
      {failed || nextPageFailed ? (
        <QueryErrorState
          error={error}
          onRetry={onRetry}
          message={nextPageFailed ? t('moreError') : t('listError')}
          className="py-8"
        />
      ) : null}
    </>
  );
}
