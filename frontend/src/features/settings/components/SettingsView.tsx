'use client';

import { useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, ChevronDown, Clock, Info, Languages, Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { navFeature } from '@thekra/practice-core';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSignInHrefs } from '@/features/practice/hooks/useSignInHref';
import { VaultPanel } from '@/features/practice/components/VaultPanel';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { usePrayerSettings } from '@/lib/practice/screen-stores';
import { AccountDataPanel, DeleteAccount } from './AccountDataPanel';
import { AccountSection } from './AccountSection';

const noSubscribe = () => () => {};

/** A page's web route from the shared navigation map (practice-core `nav-map.ts`), so a move there moves the link here. */
function webRoute(key: string): string {
  const route = navFeature(key)?.web;
  if (!route) throw new RangeError(`No web route for ${key}`);
  return route;
}

/**
 * «الإعدادات» (owner round 5, §1 IA): the same rows as the app's settings group, in its order: «الحساب», «التنبيهات»,
 * «أوقات الصلاة», «اللغة والمظهر», «عن ذكرى»; «منطقة الحذف» stays last and folded (W-27). Every row has the same shape:
 * an icon, its name (and its current value), then an arrow or its control on the line's end. The flower divider sits
 * between the groups only (O-04/W-23). «تذكيراتي» lives in «المحفوظات» (F-22 a) and «شعبة الأسبوع» on «شعب الإيمان»
 * (F-18 a), so neither is here.
 */
export function SettingsView() {
  const t = useTranslations('settings');
  const tLocale = useTranslations('localeSwitcher');
  const tTheme = useTranslations('theme');
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');

  const { user, isAuthenticated } = useSession();
  const hrefs = useSignInHrefs();
  // Same as the server render until mounted: the session can resolve before this page hydrates (React #418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const member = mounted && isAuthenticated && user;

  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('pageTitle') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('pageTitle')}
        </h1>
      </header>

      <div className="flex max-w-xl flex-col gap-6">
        {/* «الحساب»: the e-mail and «تسجيل الخروج», then the data and «تخفَّف» privacy; a visitor gets «سجّل الدخول». */}
        <section aria-labelledby="settings-account" className="flex flex-col gap-4">
          <h2 id="settings-account" className="sr-only">
            {t('rows.account')}
          </h2>
          {member ? (
            <>
              <ul className="flex flex-col divide-y divide-border">
                <li>
                  <AccountSection user={user} />
                </li>
                <li>
                  <AccountDataPanel />
                </li>
                <li>
                  <SettingsVault />
                </li>
              </ul>
            </>
          ) : mounted ? (
            <ul className="flex flex-col">
              <LinkRow icon={UserRound} label={t('rows.account')} value={t('rows.signIn')} hint={t('rows.signInHint')} href={hrefs.login} />
            </ul>
          ) : null}
        </section>

        {/* «التنبيهات» and «أوقات الصلاة»: practice settings, for members only (owner, 2026-11-01). */}
        {member ? (
          <>
            <SectionDivider />
            <nav aria-label={t('rowsLabel')}>
              <ul className="flex flex-col divide-y divide-border">
                <LinkRow icon={Bell} label={t('rows.notifications')} href={webRoute('notifications')} />
                <PrayerRow />
              </ul>
            </nav>
          </>
        ) : null}

        <SectionDivider />

        {/* «اللغة والمظهر»: both controls in place, in the same row shape. */}
        <section aria-labelledby="settings-appearance" className="flex flex-col gap-1">
          <h2 id="settings-appearance" className="text-sm font-medium text-muted-foreground">
            {t('rows.appearance')}
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            <li>
              <Row icon={Languages} label={t('language')}>
                <LocaleSwitcher label={tLocale('label')} />
              </Row>
            </li>
            <li>
              <Row icon={Palette} label={t('theme')}>
                <ThemeToggle
                  labels={{
                    toggle: tTheme('toggle'),
                    light: tTheme('light'),
                    dark: tTheme('dark'),
                    system: tTheme('system'),
                  }}
                />
              </Row>
            </li>
          </ul>
        </section>

        <SectionDivider />

        <ul className="flex flex-col">
          <LinkRow icon={Info} label={t('rows.about')} href={webRoute('about')} />
        </ul>

        {/* «منطقة الحذف» last and folded (W-27): the destructive action is out of the way and still behind a confirmation. */}
        {member ? (
          <>
            <SectionDivider />
            <DangerZone />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** The row shape: icon, name (and value), and the row's control on the end. */
function Row({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-1">
      <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base">{label}</span>
        {value ? <span className="truncate text-sm text-muted-foreground">{value}</span> : null}
      </span>
      {children ? <div className="flex shrink-0 items-center">{children}</div> : null}
    </div>
  );
}

/** A row that opens a page: the whole line is the link, an arrow on its end. */
function LinkRow({ icon: Icon, label, value, hint, href }: { icon: LucideIcon; label: string; value?: string; hint?: string; href: ComponentProps<typeof Link>['href'] }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 py-1 text-foreground transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base">{label}</span>
          {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
        </span>
        {value ? <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span> : null}
        <DirectionalArrow className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/** «أوقات الصلاة» with the city it uses (this browser's choice), or that none is set. */
function PrayerRow() {
  const t = useTranslations('settings.rows');
  const settings = usePrayerSettings();
  return <LinkRow icon={Clock} label={t('prayerTimes')} value={settings?.city || t('cityNotSet')} href={webRoute('prayer-times')} />;
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

/**
 * «تخفَّف» المشفّر: lock / unlock and change the privacy code (owner, 2026-11-01: always encrypted in the account), as a
 * folded row of «الحساب». The panel stays mounted while folded: it runs the vault autosave outside the practice pages.
 */
function SettingsVault() {
  const t = useTranslations('leaveSin.vault');
  const snapshot = usePracticeStore();
  if (!snapshot) return null;
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1 text-base">{t('title')}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pt-2">
        <VaultPanel programs={snapshot.store.programs} />
      </div>
    </details>
  );
}
