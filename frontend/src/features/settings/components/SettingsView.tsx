'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Separator } from '@/components/ui/separator';
import { NotificationsLink } from '@/features/practice/components/NotificationsLink';
import { ScreenSettingsLinks } from '@/features/practice/components/screen/ScreenSettingsLinks';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { Switch } from '@/components/shared/kit/switch';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSession } from '@/features/auth/hooks/useSession';
import { AccountDataPanel } from './AccountDataPanel';
import { AccountSection } from './AccountSection';
import { VaultPanel } from '@/features/practice/components/VaultPanel';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { updatePrefs } from '@/lib/practice/local-store';

const noSubscribe = () => () => {};

export function SettingsView() {
  const t = useTranslations('settings');
  const tLocale = useTranslations('localeSwitcher');
  const tTheme = useTranslations('theme');
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');

  const { user, isAuthenticated } = useSession();
  // Same as the server render until mounted: the session can resolve before this page hydrates (React #418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('pageTitle') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('pageTitle')}
        </h1>
      </header>

      <div className="flex max-w-xl flex-col gap-6">
        {/* Account section — only shown when signed in */}
        {mounted && isAuthenticated && user && (
          <>
            <AccountSection user={user} />
            <Separator />
            <AccountDataPanel />
            <Separator />
          </>
        )}

        {/* «التنبيهات», «تذكيراتي», «أوقات الصلاة»: practice settings, for members only (owner, 2026-11-01). */}
        {mounted && isAuthenticated ? (
          <>
            <section className="flex flex-col gap-3">
              <NotificationsLink />
              <ScreenSettingsLinks />
            </section>
            <Separator />
            <WeekBranchSetting />
            <Separator />
            <SettingsVault />
            <Separator />
          </>
        ) : null}

        {/* Language */}
        <section className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('language')}</p>
          </div>
          <LocaleSwitcher label={tLocale('label')} />
        </section>

        <Separator />

        {/* Theme */}
        <section className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('theme')}</p>
          </div>
          <ThemeToggle
            labels={{
              toggle: tTheme('toggle'),
              light: tTheme('light'),
              dark: tTheme('dark'),
              system: tTheme('system'),
            }}
          />
        </section>
      </div>
    </div>
  );
}

/** «شعبة الأسبوع» opt-in (owner round 3, item 7): «ورد اليوم» shows it only for a member who chose it. */
function WeekBranchSetting() {
  const t = useTranslations('settings.weekBranch');
  const snapshot = usePracticeStore();
  if (!snapshot) return null;
  return (
    <section className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span id="week-branch-label" className="text-sm font-medium">
          {t('label')}
        </span>
        <span id="week-branch-hint" className="text-sm leading-6 text-muted-foreground">
          {t('hint')}
        </span>
      </div>
      <Switch
        aria-labelledby="week-branch-label"
        aria-describedby="week-branch-hint"
        className="-mt-2"
        checked={snapshot.prefs.weekBranch === true}
        onCheckedChange={(on) => updatePrefs((p) => ({ ...p, weekBranch: on || undefined }))}
      />
    </section>
  );
}

/** «تخفَّف» المشفّر: lock / unlock and change the privacy code (owner, 2026-11-01: always encrypted in the account). */
function SettingsVault() {
  const snapshot = usePracticeStore();
  if (!snapshot) return null;
  return <VaultPanel programs={snapshot.store.programs} />;
}
