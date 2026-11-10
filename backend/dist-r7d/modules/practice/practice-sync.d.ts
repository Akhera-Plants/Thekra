import type { Prisma } from '@prisma/client';
import { type DayStateEntry, type QadaKey, type QadaPlan, type Reflection, type FardPrayer, type FardStatus, type HomeSectionPref, type HabitLoop, type PeopleCircle, type PrayerAnchor, type Rule, type Version } from '@thekra/practice-core';
import type { PrismaService } from '../../prisma/prisma.service.js';
export declare const MAX_SYNC_ITEMS = 500;
export declare const MAX_LIVE_PLANS = 50;
export declare const MAX_LIVE_RELATIVES = 200;
export declare const MAX_ARCHIVED_PLANS = 10;
export declare const MAX_READ_MARKS = 3000;
export interface SettingsWire {
    hijriOffset: number;
    reminderTimes: string[];
    freeMinutesPerDay: number | null;
    excusedDays: string[];
    homeSections: HomeSectionPref[] | null;
    fardTracking: boolean;
    dayStates: DayStateEntry[] | null;
    qada: QadaPlan | null;
    lightenCovered: boolean;
    reciter: string | null;
    clientUpdatedAt: string;
    updatedAt: string;
}
export interface SeasonWire {
    amount: number;
    until: string;
    previous: number;
}
export interface PlanWire {
    id: string;
    habitKey: string | null;
    deedSlug: string;
    title: string;
    unit: 'minutes' | 'count' | 'times';
    amount: number;
    ceiling: number | null;
    activeDaysPerWeek: number;
    slots: string[];
    rule: Rule | null;
    createdOn: string;
    amountChangedOn: string;
    ebbSince: string | null;
    season: SeasonWire | null;
    pausedOn: string | null;
    resumedOn: string | null;
    establishedOn: string | null;
    slotAnchors: (PrayerAnchor | null)[] | null;
    loops: HabitLoop[] | null;
    minimum: number | null;
    startAmount: number | null;
    restartedOn: string | null;
    clientUpdatedAt: string;
    deletedAt: string | null;
}
export interface DeletedWire {
    id: string;
    clientUpdatedAt: string;
    deletedAt: string;
}
export interface LogWire {
    planId: string;
    date: string;
    amount: number;
    correctedAt?: string | null;
}
export interface RelativeWire {
    id: string;
    name: string;
    relation: string;
    rule: Rule;
    circle: PeopleCircle;
    lastContactedOn: string | null;
    clientUpdatedAt: string;
    deletedAt: string | null;
}
export interface ContactWire {
    relativeId: string;
    date: string;
    deleted: boolean;
}
export interface FardWire {
    date: string;
    prayer: FardPrayer;
    status: FardStatus | null;
    clientUpdatedAt: string;
}
export interface ReflectionWire {
    planId: string;
    date: string;
    helped: string | null;
    hard: string | null;
    note: string | null;
    clientUpdatedAt: string;
}
export interface QadaLogWire {
    date: string;
    prayer: QadaKey;
    count: number;
    clientUpdatedAt: string;
}
export interface ReadWire {
    quoteId: string;
    read: boolean;
    clientUpdatedAt: string;
}
export interface PracticeChangesDto {
    serverTime: string;
    settings: SettingsWire | null;
    plans: (PlanWire | DeletedWire)[];
    logs: LogWire[];
    relatives: (RelativeWire | DeletedWire)[];
    contacts: ContactWire[];
    fard: FardWire[];
    reflections: ReflectionWire[];
    qadaLogs: QadaLogWire[];
    reads: ReadWire[];
}
export type SettingsChange = Omit<SettingsWire, 'updatedAt'>;
export type PlanChange = {
    kind: 'live';
    plan: PlanWire;
} | {
    kind: 'tombstone';
    id: string;
    clientUpdatedAt: string;
    deletedAt: string;
};
export type RelativeChange = {
    kind: 'live';
    relative: RelativeWire;
} | {
    kind: 'tombstone';
    id: string;
    clientUpdatedAt: string;
    deletedAt: string;
};
export interface SyncRequest {
    since: Date | null;
    settings: SettingsChange | null;
    plans: PlanChange[];
    logs: LogWire[];
    relatives: RelativeChange[];
    contacts: ContactWire[];
    fard: FardWire[];
    reflections: ReflectionWire[];
    qadaLogs: QadaLogWire[];
    reads: ReadWire[];
}
export declare function containsProgramsKey(value: unknown): boolean;
export declare function coreReflection(r: Pick<ReflectionWire, 'planId' | 'date' | 'helped' | 'hard' | 'note' | 'clientUpdatedAt'>): Reflection;
export declare function reflectionWins(stored: ReflectionWire | null, incoming: ReflectionWire): boolean;
export declare function qadaLogWins(stored: Pick<QadaLogWire, 'count' | 'clientUpdatedAt'> | null, incoming: Pick<QadaLogWire, 'count' | 'clientUpdatedAt'>): boolean;
export declare function readWins(stored: Pick<ReadWire, 'read' | 'clientUpdatedAt'> | null, incoming: Pick<ReadWire, 'read' | 'clientUpdatedAt'>): boolean;
export declare function fardWins(stored: Pick<FardWire, 'status' | 'clientUpdatedAt'> | null, incoming: Pick<FardWire, 'status' | 'clientUpdatedAt'>): boolean;
export declare function planVersion(change: PlanChange): Version;
export declare function relativeVersion(change: RelativeChange): Version;
export declare function settingsVersion(settings: Omit<SettingsChange, 'homeSections' | 'fardTracking' | 'dayStates' | 'qada' | 'lightenCovered' | 'reciter'> & Partial<Pick<SettingsChange, 'homeSections' | 'fardTracking' | 'dayStates' | 'qada' | 'lightenCovered' | 'reciter'>>): Version;
export declare function wins(stored: Version | null, incoming: Version): boolean;
export declare function parseSyncRequest(body: unknown, now?: Date): SyncRequest;
type PlanRow = Prisma.HabitPlanGetPayload<object>;
type RelativeRow = Prisma.RelativeGetPayload<object>;
export declare function planRowToWire(row: PlanRow): PlanWire | DeletedWire;
export declare function relativeRowToWire(row: RelativeRow): RelativeWire | DeletedWire;
export declare function planToWire(row: PlanRow): PlanWire;
export declare function relativeToWire(row: RelativeRow): RelativeWire;
export interface EchoKeys {
    settings: boolean;
    planIds: string[];
    logKeys: {
        planId: string;
        date: string;
    }[];
    relativeIds: string[];
    contactKeys: {
        relativeId: string;
        date: string;
    }[];
    fardKeys?: {
        date: string;
        prayer: string;
    }[];
    reflectionKeys?: {
        planId: string;
        date: string;
    }[];
    qadaKeys?: {
        date: string;
        prayer: string;
    }[];
    readIds?: string[];
}
export declare function readPracticeChanges(db: Pick<PrismaService, 'practiceSettings' | 'habitPlan' | 'habitLog' | 'relative' | 'relativeContact' | 'fardMark' | 'habitReflection' | 'qadaLog' | 'quoteRead'>, userId: string, since: Date | null, serverTime: Date, echo?: EchoKeys): Promise<PracticeChangesDto>;
export declare function dayStatesOf(value: unknown): DayStateEntry[] | null;
export declare function homeSectionsOf(value: unknown): HomeSectionPref[] | null;
export {};
