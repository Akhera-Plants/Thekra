/**
 * Hooks of the tazkiya features on the hub (docs/plan/2026-10-tazkiya-tracker-proposals.md items 5–7): the catalog's
 * prompts, the private journal, which prompt is due now, the fresh-start card of the day, and the short supplication
 * after a tick. Rules live in practice-core (tazkiya.ts, fresh-start.ts); the words in the catalog.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  celebrationLine,
  dismiss,
  duePrompt,
  freshStartAction,
  freshStartFor,
  freshStartKey,
  promptKey,
  setMuhasaba,
  setNiyyah,
  todayFrom,
  type FreshStart,
  type FreshStartAction,
  type LocalDate,
  type LocalTime,
  type MuhasabaQuestion,
  type TazkiyaPrompt,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import type { TazkiyaPrompts } from './catalog-types';
import { nowTime } from './format';
import { usePracticeStore } from './practice-store';
import { useTazkiyaStore } from './tazkiya-store';
import { useUiLocale } from './use-practice-lifecycle';

/** How long the supplication stays after a tick. */
export const CELEBRATION_MS = 2000;
const CLOCK_MS = 60_000;

/** The catalog's tazkiya prompts, or undefined while loading, on error, or from an API that does not send them. */
export function useTazkiyaPrompts(): TazkiyaPrompts | undefined {
  const locale = useUiLocale();
  return usePracticeCatalog(locale).data?.tazkiya;
}

/** The private journal, loaded from the device on first use. */
export function useJournal() {
  const hydrated = useTazkiyaStore((s) => s.hydrated);
  const journal = useTazkiyaStore((s) => s.journal);
  const hydrate = useTazkiyaStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return { hydrated, journal };
}

function localNow(): { date: LocalDate; time: LocalTime } {
  const now = new Date();
  return { date: todayFrom(now), time: nowTime(now) };
}

/** The local day and minute, refreshed every minute and on every return to the foreground. */
export function useLocalClock() {
  const [now, setNow] = useState(localNow);
  useEffect(() => {
    const refresh = () => setNow(localNow());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, CLOCK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return now;
}

/** The private prompt the hub shows now (practice-core `duePrompt`), only once the catalog has its words. */
export function useDuePrompt(hasHabitsToday: boolean, started: boolean): { prompt: TazkiyaPrompt | null; date: LocalDate } {
  const prompts = useTazkiyaPrompts();
  const { hydrated, journal } = useJournal();
  const { date, time } = useLocalClock();
  const prompt = useMemo(
    () => (prompts && hydrated ? duePrompt(journal, { date, time, hasHabitsToday, started }) : null),
    [prompts, hydrated, journal, date, time, hasHabitsToday, started],
  );
  return { prompt, date };
}

/** Saving the intention and the evening entry, and «ليس الآن». */
export function useJournalActions() {
  const update = useTazkiyaStore((s) => s.update);
  const saveNiyyah = useCallback(
    (date: LocalDate, planId: string, title: string, note: string) => update((j) => setNiyyah(j, date, { planId, title, note })),
    [update],
  );
  const saveMuhasaba = useCallback(
    (date: LocalDate, answers: Partial<Record<MuhasabaQuestion, string>>, thanked: boolean) =>
      update((j) => setMuhasaba(j, date, { answers, thanked })),
    [update],
  );
  const setAside = useCallback((key: string) => update((j) => dismiss(j, key)), [update]);
  const setPromptAside = useCallback((prompt: TazkiyaPrompt, date: LocalDate) => setAside(promptKey(prompt, date)), [setAside]);
  return { saveNiyyah, saveMuhasaba, setAside, setPromptAside };
}

export interface FreshStartCardModel {
  start: FreshStart;
  /** The set-aside key of this occasion. */
  key: string;
  text: TazkiyaPrompts['freshStarts']['occasions'][number];
  labels: TazkiyaPrompts['freshStarts'];
  action: FreshStartAction;
}

/** The fresh-start card of `today`, at most one (practice-core `freshStartFor` with the user's Hijri offset). */
export function useFreshStartCard(today: LocalDate): FreshStartCardModel | null {
  const prompts = useTazkiyaPrompts();
  const { hydrated, journal } = useJournal();
  const plans = usePracticeStore((s) => s.store.plans);
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  return useMemo(() => {
    if (!prompts || !hydrated) return null;
    const start = freshStartFor(today, hijriOffset, journal.dismissed);
    const text = start ? prompts.freshStarts.occasions.find((o) => o.kind === start.kind) : undefined;
    if (!start || !text) return null;
    return { start, key: freshStartKey(start), text, labels: prompts.freshStarts, action: freshStartAction(plans, today) };
  }, [prompts, hydrated, journal.dismissed, today, hijriOffset, plans]);
}

/** The lines take turns across the app; the first one differs from launch to launch. */
let turn = Math.floor(Math.random() * 1000);

/**
 * «تقبّل الله منك» for {@link CELEBRATION_MS} after a tick: one short line from the catalog, attached to the row
 * that was ticked (`key`). No sound, no counter; the caller owns the haptic.
 */
export function useCelebration() {
  const locale = useUiLocale();
  const prompts = useTazkiyaPrompts();
  const [shown, setShown] = useState<{ key: string; line: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const celebrate = useCallback(
    (key: string) => {
      const lines = prompts ? (locale === 'en' ? prompts.celebrations.linesEn : prompts.celebrations.linesAr) : [];
      const line = celebrationLine(lines, turn);
      turn += 1;
      if (!line) return;
      if (timer.current) clearTimeout(timer.current);
      setShown({ key, line });
      timer.current = setTimeout(() => setShown(null), CELEBRATION_MS);
    },
    [prompts, locale],
  );

  return { celebration: shown, celebrate };
}
