import { type NotificationPrefs, type PrayerAnchor, type Store } from '@thekra/practice-core';
import type { Habit, Occasion } from '../practice/practice-catalog.js';
export declare const PUSH_WINDOW_HOURS = 48;
export declare const MAX_PUSH_PER_WINDOW = 40;
export type PushLocale = 'ar' | 'en';
export interface PlannedPush {
    key: string;
    fireAt: Date;
    title: string;
    body: string;
    url: string;
    tag: string;
    digest: string;
}
export interface PushPlanInput {
    store: Store;
    habits: readonly Habit[];
    occasions?: readonly Occasion[];
    timeZone: string;
    locale: PushLocale;
    now: Date;
    prefs?: NotificationPrefs;
    anchorTimes?: Record<string, Record<PrayerAnchor, string>>;
    windowHours?: number;
    limit?: number;
}
export declare function sitePath(locale: 'ar' | 'en', path: string): string;
export declare function planPushes(input: PushPlanInput): PlannedPush[];
