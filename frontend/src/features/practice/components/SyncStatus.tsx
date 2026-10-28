'use client';

import { CloudCheck, CloudOff, HardDrive, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { failureKey } from '@/lib/errors';
import { formatDateTime } from '@/lib/practice/format';
import { mergeIntoAccount, syncNow } from '@/lib/practice/sync-controller';
import { usePracticeSync } from '../hooks/usePracticeSync';
import { useSignInHrefs } from '../hooks/useSignInHref';

interface SyncStatusProps {
  /** False when the browser refused storage (private window, blocked site data). */
  persistent: boolean;
  /** Calendar: only the account line when signed in, no sign-in prompt for guests. */
  quiet?: boolean;
}

/**
 * Where the data lives and the account sync state: always on this device; with an account, also synced
 * («متزامن» / «غير متزامن، سيُعاد المحاولة» / last sync time). Runs the sync while mounted.
 */
export function SyncStatus({ persistent, quiet = false }: SyncStatusProps) {
  const t = useTranslations('practice.sync');
  const tStorage = useTranslations('practice.storage');
  const tFeedback = useTranslations('feedback');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { status, accounts, signedIn, sessionLoading } = usePracticeSync();
  const hrefs = useSignInHrefs();

  const storageLine = !persistent ? (
    <Line icon={<TriangleAlert className="text-destructive" />} role="status">
      {tStorage('memoryOnly')}
    </Line>
  ) : null;

  if (!accounts || sessionLoading || !signedIn) {
    if (quiet) return storageLine;
    return (
      <div className="flex flex-col gap-2">
        {storageLine ?? (
          <Line icon={<HardDrive className="text-primary" />}>{accounts ? t('localGuest') : tStorage('local')}</Line>
        )}
        {accounts && !sessionLoading ? (
          <p className="flex flex-wrap gap-x-4 gap-y-1 ps-6 text-sm">
            <Link href={hrefs.login} className="text-link">
              {t('signIn')}
            </Link>
            <Link href={hrefs.register} className="text-link">
              {t('register')}
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const last = status.lastSyncedAt ? t('lastSynced', { time: formatDateTime(status.lastSyncedAt, locale) }) : null;

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {storageLine}
      {status.phase === 'otherAccount' ? (
        <div className="flex flex-col items-start gap-2">
          <Line icon={<CloudOff className="text-muted-foreground" />}>{t('otherAccount')}</Line>
          <Button
            variant="outline"
            tone="primary"
            size="sm"
            className="ms-6 h-auto whitespace-normal py-2 text-start"
            onClick={mergeIntoAccount}
          >
            {t('mergeHere')}
          </Button>
        </div>
      ) : status.phase === 'error' || status.phase === 'offline' ? (
        <div className="flex flex-col items-start gap-2">
          <Line icon={<CloudOff className="text-destructive" />} role="status">
            {status.willRetry ? t('notSyncedRetrying') : t('notSynced')}
            {status.phase === 'offline' ? ` ${t('offline')}` : ` ${tFeedback(`error.${failureKey(status.error)}`)}`}
          </Line>
          <Button variant="outline" tone="primary" size="sm" className="ms-6" onClick={syncNow}>
            <RefreshCw aria-hidden />
            {t('syncNow')}
          </Button>
        </div>
      ) : status.phase === 'syncing' ? (
        <Line icon={<LoaderCircle className="text-primary motion-safe:animate-spin" />}>{t('syncing')}</Line>
      ) : (
        <Line icon={<CloudCheck className="text-primary" />}>
          {status.phase === 'pending' ? t('pending') : t('synced')}
          {last ? <span className="text-muted-foreground"> · {last}</span> : null}
        </Line>
      )}
      {quiet ? null : (
        <p className="ps-6 text-sm leading-7 text-muted-foreground">
          {t('signedInNote')}{' '}
          <Link href="/settings" className="text-link">
            {t('accountLink')}
          </Link>
        </p>
      )}
    </div>
  );
}

function Line({ icon, role, children }: { icon: React.ReactNode; role?: 'status'; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-7 text-muted-foreground" role={role}>
      <span className="mt-1.5 shrink-0 [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}
