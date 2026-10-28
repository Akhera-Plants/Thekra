/**
 * Keeps the practice feature alive in the background of the UI:
 * - hydrates the on-device store;
 * - re-plans local notifications after every change (debounced) and on every foreground;
 * - ends finished seasons on foreground (`normalize`);
 * - syncs plans/relatives/settings with the account when signed in (on sign-in, on foreground, and a few
 *   seconds after a change of synced data);
 * - opens the right screen when a reminder is tapped.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { exportForSync, type PlanUnit } from '@thekra/practice-core';
import { useAuthStore } from '../stores/auth-store';
import { queryKeys } from '../query-keys';
import type { PracticeCatalog, UiLocale } from './catalog-types';
import { nowTime } from './format';
import { applyReminders, configureNotificationHandler, onReminderTapped } from './notifications';
import { usePracticeStore, today } from './practice-store';
import { planReminders, type ReminderTexts } from './reminders';
import { syncPractice } from './sync-runner';
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
    kinshipTitle: t('practice.notify.kinshipTitle'),
    kinshipBodyGeneric: (count) => t('practice.notify.kinshipBodyGeneric', { n: String(count) }),
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
    });
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

  // Store or prefs changed → re-plan reminders (debounced); synced data changed → sync (debounced).
  useEffect(() => {
    if (!hydrated) return;
    let remindTimer: ReturnType<typeof setTimeout> | null = null;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSynced = JSON.stringify(exportForSync(usePracticeStore.getState().store));
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.store === prev.store && state.prefs === prev.prefs) return;
      if (remindTimer) clearTimeout(remindTimer);
      remindTimer = setTimeout(() => void rescheduleRef.current(), 800);
      const json = JSON.stringify(exportForSync(state.store));
      if (json !== lastSynced && userIdRef.current) {
        lastSynced = json;
        if (syncTimer) clearTimeout(syncTimer);
        const userId = userIdRef.current;
        syncTimer = setTimeout(() => void syncPractice(userId), 4000);
      }
    });
    void rescheduleRef.current();
    return () => {
      unsub();
      if (remindTimer) clearTimeout(remindTimer);
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [hydrated]);

  // The catalog (titles, unit words) arrived or the language changed → re-plan.
  useEffect(() => {
    if (hydrated && catalog.data) void rescheduleRef.current();
  }, [hydrated, catalog.data, locale]);

  // Signed in (or switched account) → sync.
  useEffect(() => {
    if (hydrated && user?.id) void syncPractice(user.id);
  }, [hydrated, user?.id]);

  // Foreground → end finished seasons, refresh the 14-day window, sync.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !usePracticeStore.getState().hydrated) return;
      usePracticeStore.getState().normalizeToday();
      void rescheduleRef.current();
      if (userIdRef.current) void syncPractice(userIdRef.current);
    });
    return () => sub.remove();
  }, []);
}
