'use client';

import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSession } from '@/features/auth/hooks/useSession';
import { AccountDataPanel } from './AccountDataPanel';
import { AccountSection } from './AccountSection';

export function SettingsView() {
  const t = useTranslations('settings');
  const tLocale = useTranslations('localeSwitcher');
  const tTheme = useTranslations('theme');

  const { user, isAuthenticated } = useSession();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('pageTitle')}</h1>

      <div className="flex flex-col gap-6">
        {/* Account section — only shown when signed in */}
        {isAuthenticated && user && (
          <>
            <AccountSection user={user} />
            <Separator />
            <AccountDataPanel />
            <Separator />
          </>
        )}

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
