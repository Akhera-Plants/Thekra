'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { CalendarCheck, NotebookText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { useSession } from '@/features/auth/hooks/useSession';
import { useWirdContext } from '@/features/practice/hooks/useWirdContext';
import { StreakFlame } from '@/features/practice/components/hub/StreakFlame';
import { formatDigits } from '@/lib/format/digits';
import { wirdSummary } from '@/lib/practice/wird';

/** Remembers the last answer, so a signed-in user does not see the guest page flash first. Per-device convenience only. */
const SIGNED_IN_HINT = 'thekra.home.signed-in';

function readHint(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_HINT) === '1';
  } catch {
    return false;
  }
}

function writeHint(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(SIGNED_IN_HINT, '1');
    else window.localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // Storage blocked (private window): the page still works, the two cards may only appear after loading.
  }
}

const noSubscribe = () => () => {};

/** Signed in. False during the server render: the home is cached and the same for everyone. */
function useSignedIn(): boolean {
  const session = useSession();
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  // Same as the server render until mounted: the session can resolve before the home hydrates (React #418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const known = mounted && !session.isLoading;
  useEffect(() => {
    if (known) writeHint(session.isAuthenticated);
  }, [known, session.isAuthenticated]);
  return known ? session.isAuthenticated : hint;
}

interface HomeLayoutProps {
  /** «أبواب الخير»: «تخفَّف من معصية» · «أعنّي على فعل طاعة» · «شُعَب الإيمان» and «مواسم الخير». */
  pathways: ReactNode;
  /** Everything under the doors, in the order it always had (moments, «تذكرة مختارة», reflection, sources). */
  children: ReactNode;
}

/**
 * The home (owner decision, 2026-11-01): «أبواب الخير» is the top of the page for everyone who is not signed in. A
 * signed-in user sees two large cards first, the size of the doors: «ورد اليوم» (what is left today and the streak) and
 * «عاداتي»; the doors and the rest follow unchanged.
 */
export function HomeLayout({ pathways, children }: HomeLayoutProps) {
  const signedIn = useSignedIn();
  return (
    <>
      {signedIn ? <SignedInActions /> : null}
      {pathways}
      {children}
    </>
  );
}

function SignedInActions() {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');
  const tWird = useTranslations('practice.wird');
  const context = useWirdContext({ catalogOnlyWithPlans: true });
  const summary = context ? wirdSummary(context.snapshot.store, context.today, context.planDays) : null;
  const hasPlans = summary?.hasPlans ?? false;

  return (
    <nav className="home-actions" aria-label={t('actionsLabel')}>
      <Link className="pathway pathway-primary" href={hasPlans ? '/practice' : { pathname: '/practice', query: { add: '1' } }}>
        <span className="pathway-top">
          <span className="pathway-icon">
            <CalendarCheck className="size-7" aria-hidden />
          </span>
          {summary && hasPlans ? (
            <span
              className="pathway-overline home-actions-streak"
              aria-label={tWird('streakLabel', { count: summary.streak, n: formatDigits(summary.streak) })}
            >
              <StreakFlame className="size-4" />
              <span aria-hidden>{formatDigits(summary.streak)}</span>
            </span>
          ) : null}
        </span>
        <span className="pathway-title">{tNav('practice')}</span>
        <span className="pathway-description">
          {!summary || !hasPlans
            ? t('wirdEmpty')
            : summary.remaining > 0
              ? t('wirdLeft', { count: summary.remaining, n: formatDigits(summary.remaining) })
              : t('wirdDone')}
        </span>
        <span className="pathway-cta">
          {hasPlans ? t('wirdCta') : t('startCta')}{' '}
          <span className="pathway-arrow">
            <DirectionalArrow className="size-[19px]" />
          </span>
        </span>
      </Link>

      <Link className="pathway pathway-soft" href="/practice/habits">
        <span className="pathway-top">
          <span className="pathway-icon">
            <NotebookText className="size-7" aria-hidden />
          </span>
        </span>
        <span className="pathway-title">{tNav('habits')}</span>
        <span className="pathway-description">{t('habitsDescription')}</span>
        <span className="pathway-cta">
          {t('habitsCta')}{' '}
          <span className="pathway-arrow">
            <DirectionalArrow className="size-[19px]" />
          </span>
        </span>
      </Link>
    </nav>
  );
}
