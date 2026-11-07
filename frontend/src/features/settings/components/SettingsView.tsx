'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Bell, ChevronDown, Clock, NotebookPen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { Switch } from '@/components/shared/kit/switch';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSession } from '@/features/auth/hooks/useSession';
import { AccountDataPanel, DeleteAccount } from './AccountDataPanel';
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

      {/* The flower divider between sections; hairlines only inside a list (owner round 5, O-04/W-23). */}
      <div className="flex max-w-xl flex-col gap-6">
        {/* Account section — only shown when signed in */}
        {mounted && isAuthenticated && user && (
          <>
            <AccountSection user={user} />
            <SectionDivider />
            <AccountDataPanel />
            <SectionDivider />
          </>
        )}

        {/* «التنبيهات», «تذكيراتي», «أوقات الصلاة»: practice settings, for members only (owner, 2026-11-01). One link style
            for the three (W-13: no lone outlined button among links). */}
        {mounted && isAuthenticated ? (
          <>
            <SettingsLinks />
            <SectionDivider />
            <WeekBranchSetting />
            <SectionDivider />
            <SettingsVault />
            <SectionDivider />
          </>
        ) : null}

        {/* Language */}
        <section className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('language')}</p>
          </div>
          <LocaleSwitcher label={tLocale('label')} />
        </section>

        <SectionDivider />

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

        {/* «منطقة الحذف» last and folded (W-27): the destructive action is out of the way and still behind a confirmation. */}
        {mounted && isAuthenticated && user ? (
          <>
            <SectionDivider />
            <DangerZone />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Three equal rows, each an icon, a name and an arrow; a hairline between them (a list, not sections). */
function SettingsLinks() {
  const tRecord = useTranslations('practice.record');
  const tMine = useTranslations('practice.myReminders');
  const tPrayer = useTranslations('practice.prayer');
  const t = useTranslations('settings');
  const rows = [
    { href: '/practice/notifications', label: tRecord('notifications'), Icon: Bell },
    { href: { pathname: '/favorites', query: { tab: 'reminders' } }, label: tMine('title'), Icon: NotebookPen },
    { href: '/practice/prayer-times', label: tPrayer('title'), Icon: Clock },
  ] as const;
  return (
    <nav aria-label={t('practiceLinks')}>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map(({ href, label, Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex min-h-12 items-center gap-3 py-1 text-foreground transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
              <span className="min-w-0 flex-1 text-base">{label}</span>
              <DirectionalArrow className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DangerZone() {
  const t = useTranslations('settings.data');
  return (
    <details className="group flex flex-col">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {t('dangerZone')}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pt-3">
        <DeleteAccount />
      </div>
    </details>
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
