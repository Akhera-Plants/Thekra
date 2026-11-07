'use client';

import { CloudCheck, CloudOff, HardDrive, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { InfoTip } from '@/components/shared/InfoTip';
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
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { status, signedIn, sessionLoading } = usePracticeSync();
  const hrefs = useSignInHrefs();

  const storageLine = !persistent ? (
    <Line icon={<TriangleAlert className="text-destructive" />} role="status">
      {tStorage('memoryOnly')}
    </Line>
  ) : null;

  if (sessionLoading || !signedIn) {
    if (quiet) return storageLine;
    return (
      <div className="flex flex-col gap-2">
        {storageLine ?? (
          <Line icon={<HardDrive className="text-primary-text" />}>{t('localGuest')}</Line>
        )}
        {!sessionLoading ? (
          <ActionPair layout="hug" className="ps-6">
            <Button asChild variant="outline" tone="primary" size="md">
              <Link href={hrefs.login}>{t('signIn')}</Link>
            </Button>
            <Button asChild variant="outline" tone="primary" size="md">
              <Link href={hrefs.register}>{t('register')}</Link>
            </Button>
          </ActionPair>
        ) : null}
      </div>
    );
  }

  const last = status.lastSyncedAt ? t('lastSynced', { time: formatDateTime(status.lastSyncedAt, locale) }) : null;

  const failed = status.phase === 'error' || status.phase === 'offline';
  const accountLink = quiet ? null : (
    <Button asChild variant="outline" tone="primary" size="md">
      <Link href="/settings">{t('accountLink')}</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {storageLine}
      {status.phase === 'otherAccount' ? (
        <Line icon={<CloudOff className="text-muted-foreground" />}>{t('otherAccount')}</Line>
      ) : failed ? (
        // W-21: what happened, that nothing is lost, and what happens next; never a generic «not found».
        <Line icon={<CloudOff className="text-destructive" />} role="status">
          {t('notSavedYet')}
          {status.phase === 'offline' ? ` ${t('offline')}` : status.willRetry ? ` ${t('willRetry')}` : ''}
        </Line>
      ) : status.phase === 'syncing' ? (
        <Line icon={<LoaderCircle className="text-primary-text motion-safe:animate-spin" />}>{t('syncing')}</Line>
      ) : (
        <Line icon={<CloudCheck className="text-primary-text" />}>
          {status.phase === 'pending' ? t('pending') : t('synced')}
          {last ? <span className="text-muted-foreground"> · {last}</span> : null}
        </Line>
      )}
      {/* The sync action and «حسابك وبياناتك» as one pair, same size (O-02/W-03). */}
      {status.phase === 'otherAccount' ? (
        <ActionPair layout="hug" className="ps-6">
          <Button variant="solid" tone="primary" size="md" className="h-auto min-h-11 whitespace-normal py-2 text-start" onClick={mergeIntoAccount}>
            {t('mergeHere')}
          </Button>
          {accountLink}
        </ActionPair>
      ) : failed ? (
        <ActionPair layout="hug" className="ps-6">
          <Button variant="solid" tone="primary" size="md" icon={<RefreshCw aria-hidden />} onClick={syncNow}>
            {t('retry')}
          </Button>
          {accountLink}
        </ActionPair>
      ) : accountLink ? (
        <p className="flex items-center gap-1 ps-6 text-sm">
          {accountLink}
          <InfoTip>{t('signedInNote')}</InfoTip>
        </p>
      ) : null}
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
