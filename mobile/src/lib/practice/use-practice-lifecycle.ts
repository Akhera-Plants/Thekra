/**
 * Keeps the practice feature alive in the background of the UI:
 * - hydrates the on-device store;
 * - re-plans local notifications after every change (debounced) and on every foreground;
 * - syncs plans/relatives/settings with the account when signed in (on sign-in, on foreground, 3 s after a
 *   local edit, every 15 minutes while the app is active — sync contract §5);
 * - keeps the encrypted sin vault in step while it is unlocked (vault-runner.ts);
 * - opens the right screen when a reminder is tapped.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { useQueryClient } from '@tanstack/react-query';
import type { PlanUnit } from '@thekra/practice-core';
import { useAuthStore } from '../stores/auth-store';
import { queryKeys } from '../query-keys';
import type { PracticeCatalog, UiLocale } from './catalog-types';
import { nowTime } from './format';
import { applyReminders, configureNotificationHandler, onReminderTapped, setupReminderActions } from './notifications';
import { usePracticeStore, today } from './practice-store';
import { prayerContext } from './prayer-times';
import { planReminders, type ReminderTexts } from './reminders';
import { pendingCount, syncPractice } from './sync-runner';
import { isVaultUnlocked, pushVault, refreshVault } from './vault-runner';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
import { usePracticeCatalog } from '../api/practice';

type T = (key: string, opts?: Record<string, unknown>) => string;

export function reminderTexts(t: T, locale: UiLocale): ReminderTexts {
  const unitFallback: Record<PlanUnit, string> = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  return {
    habitBody: (amount) => t('practice.notify.habitBody', { amount }),
    habitLogged: t('practice.notify.habitLogged'),
    kinshipTitle: t('practice.notify.kinshipTitle'),
    kinshipBodyGeneric: (count) => t('practice.notify.kinshipBodyGeneric', { count }),
    kinshipBodyNames: (names) => t('practice.notify.kinshipBodyNames', { names }),
    sinBody: t('practice.notify.sinBody'),
    unitFallback,
    listSeparator: locale === 'ar' ? '، ' : ', ',
  };
}

export function useUiLocale(): UiLocale {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? 'en' : 'ar';
}

/** Re-plans and applies the reminders now (also used right after a permission prompt). */
export function useRescheduleReminders(): () => Promise<void> {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const qc = useQueryClient();
  return useCallback(async () => {
    const { store, prefs, hydrated } = usePracticeStore.getState();
    if (!hydrated) return;
    const catalog = qc.getQueryData<{ data: PracticeCatalog }>(queryKeys.practice.catalog(locale))?.data;
    const planned = planReminders({
      store,
      prefs,
      habits: catalog?.habits ?? [],
      today: today(),
      now: nowTime(),
      locale,
      texts: reminderTexts(t as unknown as T, locale),
      prayer: prayerContext(prefs.prayerPlace, prefs.prayerMethod, getLocales()[0]?.regionCode ?? null),
    });
    await setupReminderActions({ done: t('practice.notify.doneAction'), quietChannelName: t('practice.notify.quietChannelName') }).catch(
      () => undefined,
    );
    await applyReminders(planned, t('practice.notify.channelName'));
  }, [qc, locale, t]);
}

export function usePracticeLifecycle(): void {
  const locale = useUiLocale();
  const user = useAuthStore((s) => s.user);
  const hydrate = usePracticeStore((s) => s.hydrate);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const catalog = usePracticeCatalog(locale);
  const reschedule = useRescheduleReminders();
  const rescheduleRef = useRef(reschedule);
  rescheduleRef.current = reschedule;
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    configureNotificationHandler();
    void hydrate();
    return onReminderTapped((route) => router.push(route as never));
  }, [hydrate]);

  // Store or prefs changed → re-plan reminders (debounced 0.8 s); pending sync items → sync (debounced 3 s);
  // programs changed while the vault is unlocked → seal and PUT the vault (debounced 1.5 s).
  useEffect(() => {
    if (!hydrated) return;
    let remindTimer: ReturnType<typeof setTimeout> | null = null;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let vaultTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.store === prev.store && state.prefs === prev.prefs) return;
      if (remindTimer) clearTimeout(remindTimer);
      remindTimer = setTimeout(() => void rescheduleRef.current(), 800);
      const userId = userIdRef.current;
      // Only local edits leave something pending; applying a server response does not, so this cannot loop.
      if (userId && state.store !== prev.store && pendingCount() > 0) {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => void syncPractice(userId), 3000);
      }
      if (state.store.programs !== prev.store.programs && isVaultUnlocked()) {
        if (vaultTimer) clearTimeout(vaultTimer);
        vaultTimer = setTimeout(() => void pushVault(), 1500);
      }
    });
    void rescheduleRef.current();
    return () => {
      unsub();
      if (remindTimer) clearTimeout(remindTimer);
      if (syncTimer) clearTimeout(syncTimer);
      if (vaultTimer) clearTimeout(vaultTimer);
    };
  }, [hydrated]);

  // The catalog (titles, unit words) arrived or the language changed → re-plan.
  useEffect(() => {
    if (hydrated && catalog.data) void rescheduleRef.current();
  }, [hydrated, catalog.data, locale]);

  // Signed in (or switched account) → sync, then open the vault if it can be. (Sign-out locks the vault in
  // auth-store `clearSession`.)
  useEffect(() => {
    if (hydrated && user?.id) {
      const id = user.id;
      void syncPractice(id).then(() => refreshVault(id));
    }
  }, [hydrated, user?.id]);

  // Foreground → refresh the 14-day window, sync, refresh the vault; every 15 minutes while active → sync.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (userIdRef.current) void syncPractice(userIdRef.current);
      }, SYNC_INTERVAL_MS);
    };
    startInterval();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        if (interval) clearInterval(interval);
        interval = null;
        return;
      }
      startInterval();
      if (!usePracticeStore.getState().hydrated) return;
      void rescheduleRef.current();
      const id = userIdRef.current;
      if (id) void syncPractice(id).then(() => refreshVault(id));
    });
    return () => {
      sub.remove();
      if (interval) clearInterval(interval);
    };
  }, []);
}
