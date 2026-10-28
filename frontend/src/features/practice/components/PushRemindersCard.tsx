'use client';

import { BellOff, BellRing, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { ApiError } from '@/lib/types/api';
import { usePushReminders } from '../hooks/usePushReminders';
import { useSignInHrefs } from '../hooks/useSignInHref';

/**
 * «تنبيهات المتصفح»: reminders at the habits' times and for kinship, sent by the server to this browser.
 * Hidden when push is off on the server or accounts are off; on iPhone/iPad it explains the home-screen step.
 */
export function PushRemindersCard() {
  const t = useTranslations('practice.push');
  const hrefs = useSignInHrefs();
  const { state, enable, turnOn, disable, test } = usePushReminders();
  if (state === 'hidden') return null;

  const isBusy = enable.isPending || disable.isPending || test.isPending;
  const testNotFound = test.error instanceof ApiError && test.error.status === 404;
  const failed = enable.isError || disable.isError || (test.isError && !testNotFound);
  const isDismissed = enable.data === 'dismissed' && state === 'off';

  function handleTurnOn() {
    test.reset();
    disable.reset();
    turnOn();
  }

  function handleTurnOff() {
    test.reset();
    enable.reset();
    disable.mutate();
  }

  return (
    <section
      id="push-reminders"
      aria-labelledby="push-reminders-title"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:p-6"
    >
      <h2 id="push-reminders-title" className="inline-flex items-center gap-2 text-xl font-medium">
        {state === 'on' ? (
          <BellRing className="size-5 text-primary" aria-hidden />
        ) : (
          <BellOff className="size-5 text-muted-foreground" aria-hidden />
        )}
        {t('title')}
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">{t('note')}</p>

      {state === 'unsupported' ? <p className="text-sm leading-7">{t('unsupported')}</p> : null}

      {state === 'iosInstall' ? (
        <p className="flex items-start gap-2 text-sm leading-7">
          <Smartphone className="mt-1.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{t('iosInstall')}</span>
        </p>
      ) : null}

      {state === 'signedOut' ? (
        <p className="text-sm leading-7">
          {t('signedOut')}{' '}
          <Link href={hrefs.login} className="text-link">
            {t('signIn')}
          </Link>
        </p>
      ) : null}

      {state === 'denied' ? <p className="text-sm leading-7">{t('denied')}</p> : null}

      {state === 'off' ? (
        <div className="flex flex-col items-start gap-2">
          <Button size="sm" loading={enable.isPending} disabled={isBusy} onClick={handleTurnOn}>
            {t('turnOn')}
          </Button>
          {isDismissed ? <p className="text-sm leading-7 text-muted-foreground">{t('dismissed')}</p> : null}
        </div>
      ) : null}

      {state === 'on' ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm leading-7 text-primary">{t('on')}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" loading={test.isPending} disabled={isBusy} onClick={() => test.mutate()}>
              {t('sendTest')}
            </Button>
            <Button variant="outline" size="sm" loading={disable.isPending} disabled={isBusy} onClick={handleTurnOff}>
              {t('turnOff')}
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-sm leading-7 text-muted-foreground" role="status">
        {test.isSuccess ? t('testSent') : testNotFound ? t('testNotFound') : failed ? t('failed') : null}
      </p>
    </section>
  );
}
