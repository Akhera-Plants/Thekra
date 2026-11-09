'use client';

import { useId, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  Clock,
  EyeOff,
  Info,
  Languages,
  LayoutList,
  Mic,
  Palette,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  isLightenCovered,
  navFeature,
  RECITERS,
  reciterOf,
  resolveHomeSections,
  setHomeSectionVisible,
  setHomeSections,
  setLightenCovered,
  setReciter,
  type HomeSectionKey,
} from '@thekra/practice-core';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/shared/kit/button';
import { Switch } from '@/components/shared/kit/switch';
import { RecitationButton } from '@/components/shared/quote/RecitationButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSignInHrefs } from '@/features/practice/hooks/useSignInHref';
import { VaultPanel } from '@/features/practice/components/VaultPanel';
import { usePracticeStore } from '@/features/practice/hooks/usePracticeStore';
import { cityDisplayName } from '@/lib/practice/city-names';
import { updateStore } from '@/lib/practice/local-store';
import { usePrayerSettings } from '@/lib/practice/screen-stores';
import { cn } from '@/lib/utils';
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
 * «الإعدادات» (owner round 6, C-03a: the reference's two columns, our visuals and content). On a wide screen two groups
 * side by side — «التجربة» (التنبيهات، أوقات الصلاة، القارئ، خصّص الرئيسية، اللغة، المظهر) and «الحساب والبيانات»
 * (الحساب، تصدير البيانات، «تخفّف» المشفّر، إخفاء برامج التخفّف، عن ذكرى) — and one column on a phone. Rows are parted by
 * hairlines only (no ornamental divider between rows). «منطقة الحذف» is the last group, folded (W-27). «خصّص الرئيسية»
 * lives only here (C-04); the city shows in Arabic when its name is known.
 */
export function SettingsView() {
  const t = useTranslations('settings');
  const tLocale = useTranslations('localeSwitcher');
  const tTheme = useTranslations('theme');
  const tNav = useTranslations('nav');
  const tCrumbs = useTranslations('breadcrumbs');

  const { user, isAuthenticated } = useSession();
  const hrefs = useSignInHrefs();
  // Same as the server render until mounted: the session can resolve before this page hydrates (React error 418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const member = mounted && isAuthenticated && user;
  const snapshot = usePracticeStore();

  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('pageTitle') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('pageTitle')}
        </h1>
      </header>

      <div className="settings-grid">
        <Group id="experience" title={t('groups.experience')}>
          {member ? (
            <>
              <LinkRow icon={Bell} label={t('rows.notifications')} hint={t('rows.notificationsHint')} href={webRoute('notifications')} />
              <PrayerRow />
            </>
          ) : null}
          {snapshot ? <ReciterRow /> : null}
          {member && snapshot ? <CustomizeHomeRow /> : null}
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
        </Group>

        <Group id="account" title={t('groups.account')}>
          {member ? (
            <>
              <li>
                <AccountSection user={user} />
              </li>
              <li>
                <AccountDataPanel />
              </li>
              <li>
                <SettingsVault />
              </li>
              {snapshot ? <LightenCoverRow /> : null}
            </>
          ) : mounted ? (
            <LinkRow icon={UserRound} label={t('rows.account')} value={t('rows.signIn')} hint={t('rows.signInHint')} href={hrefs.login} />
          ) : null}
          <LinkRow icon={Info} label={t('rows.about')} href={webRoute('about')} />
        </Group>

        {/* «منطقة الحذف» last and folded (W-27): out of the way and still behind a confirmation. */}
        {member ? (
          <div className="settings-danger">
            <DangerZone />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** One group: its heading and its rows, parted by hairlines. */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`settings-${id}`} className="flex min-w-0 scroll-mt-6 flex-col gap-2">
      <h2 id={`settings-${id}`} className="text-2xl font-medium">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border border-b border-border">{children}</ul>
    </section>
  );
}

/** The row shape: icon, name (and value or hint), and the row's control on the end. */
function Row({ icon: Icon, label, value, hint, children }: { icon: LucideIcon; label: string; value?: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center gap-3 py-2">
      <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base">{label}</span>
        {value ? <span className="truncate text-sm text-muted-foreground">{value}</span> : null}
        {hint ? <span className="text-sm leading-6 text-muted-foreground">{hint}</span> : null}
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
        className="flex min-h-16 items-center gap-3 py-2 text-foreground transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base">{label}</span>
          {hint ? <span className="text-sm leading-6 text-muted-foreground">{hint}</span> : null}
        </span>
        {value ? <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span> : null}
        <DirectionalArrow className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/** «أوقات الصلاة» with the city it uses (this browser's choice, in Arabic when its name is known), or that none is set. */
function PrayerRow() {
  const t = useTranslations('settings.rows');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const settings = usePrayerSettings();
  const city = settings?.city ? cityDisplayName(settings.city, locale) : null;
  return <LinkRow icon={Clock} label={t('prayerTimes')} value={city ?? t('cityNotSet')} href={webRoute('prayer-times')} />;
}

/** The ayah each reciter plays as a preview (al-Fatiha 1:2). */
const PREVIEW = { surah: 1, ayah: 2 } as const;

/**
 * «القارئ» (owner round 6 §8 «Audio»): the reciter every verse card plays, synced with the settings (practice-core
 * `reciters.ts`). A tap opens the list; each reciter has a short preview beside its name.
 */
function ReciterRow() {
  const t = useTranslations('settings.reciter');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const [open, setOpen] = useState(false);
  const chosen = reciterOf(snapshot?.store.settings.reciter);
  const name = (r: typeof chosen) => (locale === 'en' ? r.en : r.ar);
  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${t('label')}: ${name(chosen)}`}
            className="flex min-h-16 w-full items-center gap-3 py-2 text-start transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Mic aria-hidden className="size-5 shrink-0 text-primary-text" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base">{t('label')}</span>
              <span className="truncate text-sm text-muted-foreground">{name(chosen)}</span>
            </span>
            <ChevronDown aria-hidden className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-2">
          <p className="px-2 pt-1 pb-2 text-sm leading-6 text-muted-foreground">{t('hint')}</p>
          <div role="radiogroup" aria-label={t('label')} className="flex flex-col">
            {RECITERS.map((reciter) => {
              const on = reciter.key === chosen.key;
              return (
                <div key={reciter.key} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      updateStore((store) => setReciter(store, reciter.key));
                      toast.success(t('saved', { name: name(reciter) }));
                    }}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start text-[15px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-checked:font-medium aria-checked:text-primary-text"
                  >
                    <Check aria-hidden className={cn('size-4 shrink-0', !on && 'invisible')} />
                    <span className="truncate">{name(reciter)}</span>
                  </button>
                  <RecitationButton
                    surah={PREVIEW.surah}
                    ayah={PREVIEW.ayah}
                    reciter={reciter.key}
                    label={t('preview', { name: name(reciter) })}
                  />
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </li>
  );
}

/**
 * «خصّص الرئيسية» (round 5, F-02 a; round 6, C-04: in the settings only): show/hide and move each home section. Every
 * change is saved at once and syncs with the app. The order shown is the order the home draws.
 */
function CustomizeHomeRow() {
  const t = useTranslations('home.customize');
  const snapshot = usePracticeStore();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const list = resolveHomeSections(snapshot?.store.settings.homeSections);
  const title = (key: HomeSectionKey) => t(`sections.${key}`);

  function move(key: HomeSectionKey, by: -1 | 1) {
    const at = list.findIndex((s) => s.key === key);
    if (!list[at + by]) return;
    const next = [...list];
    const [item] = next.splice(at, 1);
    next.splice(at + by, 0, item!);
    updateStore((store) => setHomeSections(store, next));
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-16 w-full items-center gap-3 py-2 text-start transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <LayoutList aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base">{t('open')}</span>
          <span className="text-sm leading-6 text-muted-foreground">{t('lead')}</span>
        </span>
        <ChevronDown aria-hidden className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <ol id={panelId} hidden={!open} className="flex flex-col pb-3 ps-8">
        {list.map((section, index) => (
          <li key={section.key} className="flex min-h-12 items-center gap-1.5">
            <span className={cn('min-w-0 flex-1 text-[15px]', !section.visible && 'text-muted-foreground')}>{title(section.key)}</span>
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              iconOnly
              icon={<ArrowUp aria-hidden />}
              aria-label={t('up', { title: title(section.key) })}
              disabled={index === 0}
              onClick={() => move(section.key, -1)}
            />
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              iconOnly
              icon={<ArrowDown aria-hidden />}
              aria-label={t('down', { title: title(section.key) })}
              disabled={index === list.length - 1}
              onClick={() => move(section.key, 1)}
            />
            <Switch
              aria-label={t('show', { title: title(section.key) })}
              checked={section.visible}
              onCheckedChange={(on) =>
                updateStore((store) => setHomeSections(store, setHomeSectionVisible(store.settings.homeSections, section.key, on)))
              }
            />
          </li>
        ))}
      </ol>
    </li>
  );
}

/**
 * «إخفاء برامج التخفّف» (round 6, C-02e): «تخفّف» programs show in «العادات» as covered rows (no sin name) until the
 * privacy code opens them. On by default; synced (practice-core `setLightenCovered`).
 */
function LightenCoverRow() {
  const t = useTranslations('settings.lightenCover');
  const snapshot = usePracticeStore();
  const labelId = useId();
  const hintId = useId();
  if (!snapshot) return null;
  return (
    <li className="flex min-h-16 items-center gap-3 py-2">
      <EyeOff aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={labelId} className="text-base">
          {t('label')}
        </span>
        <span id={hintId} className="text-sm leading-6 text-muted-foreground">
          {t('hint')}
        </span>
      </span>
      <Switch
        aria-labelledby={labelId}
        aria-describedby={hintId}
        checked={isLightenCovered(snapshot.store)}
        onCheckedChange={(on) => updateStore((store) => setLightenCovered(store, on))}
      />
    </li>
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
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1 text-base">{t('title')}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pb-3">
        <VaultPanel programs={snapshot.store.programs} />
      </div>
    </details>
  );
}
