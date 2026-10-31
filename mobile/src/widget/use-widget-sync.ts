/**
 * Keeps the home-screen widgets current (Android): rebuilds the snapshot when the practice store, the prefs, the
 * catalog, the reminder sets or the saved texts change, and on every foreground; `saveWidgetSnapshot` skips writes
 * when nothing changed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFavorites } from '@/lib/api/favorites';
import { useReminderSets } from '@/lib/api/reminder-sets';
import { useAuthStore } from '@/lib/stores/auth-store';
import { queryKeys } from '@/lib/query-keys';
import type { ReminderSetDto } from '@/lib/api/reminder-sets';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeCatalog } from '@/lib/practice/catalog-types';
import { pick } from '@/lib/practice/catalog-types';
import { habitFor } from '@/lib/practice/reminders';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { quoteAttribution, type QuoteShareLabels } from '@/lib/share/quote-share';
import { buildWidgetSnapshot, type WidgetLabels, type WidgetText } from './snapshot';
import { saveWidgetSnapshot } from './update';

export function useWidgetSync(): void {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const qc = useQueryClient();
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const sourceKind = usePracticeStore((s) => s.prefs.todayText.kind);
  // Keep the sources in the query cache (both persisted for offline use).
  useReminderSets();
  useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: () => fetchFavorites(),
    enabled: signedIn && sourceKind === 'saved',
    networkMode: 'offlineFirst',
    staleTime: Infinity,
  });

  const rebuild = useCallback(() => {
    const { store, prefs, hydrated } = usePracticeStore.getState();
    if (!hydrated) return;
    const catalog = qc.getQueryData<{ data: PracticeCatalog }>(queryKeys.practice.catalog(locale))?.data;
    const shareLabels: QuoteShareLabels = {
      atharNotice: t('share.atharNotice'),
      atharNarrated: (speaker) => t('share.atharNarrated', { speaker }),
      grade: { SAHIH: t('grade.SAHIH'), HASAN: t('grade.HASAN'), DAIF: t('grade.DAIF'), MAWDU: t('grade.MAWDU') },
    };
    const fromQuote = (q: QuoteDto): WidgetText => ({ text: q.textAr, attribution: quoteAttribution(q, shareLabels, locale)[0] ?? '' });
    const source = prefs.todayText;
    let texts: WidgetText[] = [];
    if (source.kind === 'set') {
      const sets = qc.getQueryData<{ data: ReminderSetDto[] }>(queryKeys.reminderSets.all)?.data ?? [];
      texts = (sets.find((s) => s.slug === source.slug)?.items ?? []).map(fromQuote);
    } else if (source.kind === 'saved' && signedIn) {
      texts = (qc.getQueryData<{ data: QuoteDto[] }>(queryKeys.favorites.all)?.data ?? []).map(fromQuote);
    } else if (source.kind === 'mine') {
      texts = prefs.myReminders.map((r) => ({ text: r.text, attribution: '' }));
    }
    const labels: WidgetLabels = {
      streak: t('widget.streak'),
      remaining: t('widget.remaining', { n: '{n}' }),
      allDone: t('widget.allDone'),
      wird: t('widget.wird'),
      openApp: t('widget.openApp'),
      noHabits: t('widget.noHabits'),
      dailyText: t('widget.dailyText'),
      noText: t('widget.noText'),
      seasons: t('widget.seasons'),
      todayOccasion: t('widget.todayOccasion', { title: '{title}' }),
      nextOccasion: t('widget.nextOccasion', { title: '{title}', date: '{date}' }),
      months: t('widget.months').split(','),
    };
    const habits = catalog?.habits ?? [];
    const snapshot = buildWidgetSnapshot({
      store,
      today: today(),
      planDays: { hijriOffset: store.settings.hijriOffset, defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule },
      occasions: catalog?.occasions ?? [],
      titleOf: (planId) => {
        const plan = store.plans.find((p) => p.id === planId);
        if (!plan) return '';
        const habit = habitFor(plan, habits);
        return habit ? pick(habit, 'title', locale) : plan.title;
      },
      source,
      texts,
      labels,
      locale,
    });
    void saveWidgetSnapshot(snapshot);
  }, [qc, locale, t, signedIn]);

  const rebuildRef = useRef(rebuild);
  rebuildRef.current = rebuild;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => rebuildRef.current(), 600);
    };
    const unsubStore = usePracticeStore.subscribe((state, prev) => {
      if (state.store !== prev.store || state.prefs !== prev.prefs || state.hydrated !== prev.hydrated) later();
    });
    const unsubQueries = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey[0];
      if (event.type === 'updated' && (key === 'reminder-sets' || key === 'favorites' || key === 'practice')) later();
    });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') later();
    });
    later();
    return () => {
      unsubStore();
      unsubQueries();
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [qc]);

  // Language or account changed → rebuild with the new words and sources.
  useEffect(() => {
    rebuildRef.current();
  }, [locale, signedIn]);
}
