import { type DeedWindow, type PeopleCircle, type PlanUnit, type RakahCount, type Rule, type SinCategory, type Stage } from '@thekra/practice-core';
import { type MujahadaTexts } from './heart-texts.js';
export type Basis = 'text' | 'organizational';
export interface Occasion {
    key: string;
    titleAr: string;
    titleEn: string;
    deed: string;
    rule: Rule;
    basis: Basis;
    evidence: string[];
}
export interface Habit {
    key: string;
    kind?: 'periodic';
    people?: PeopleCircle;
    titleAr: string;
    titleEn: string;
    deed: string;
    unit: PlanUnit;
    unitLabelAr: string;
    unitLabelEn: string;
    rakah?: RakahCount;
    start: {
        far: number;
        near: number;
    };
    ceiling?: number;
    defaultRule: Rule;
    timeHintAr?: string;
    timeHintEn?: string;
    defaultSlots: string[];
    window?: DeedWindow;
    basis: Basis;
    evidence: string[];
}
export interface ProgramText {
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    lines?: number[];
    evidence?: string[];
}
export interface SinProgramsCommon {
    willQuestionAr: string;
    willQuestionEn: string;
    stageMinDays: number;
    stages: Record<Stage, ProgramText>;
    afterFall: ProgramText;
    helpAr: string;
    helpEn: string;
}
export interface SinProgramEntry {
    sin: string;
    category: SinCategory;
    gradualAllowed: boolean;
    help: boolean;
    gradualStepsAr?: string[];
    gradualStepsEn?: string[];
    actionsAr: string[];
    actionsEn: string[];
    alternatives: string[];
    evidence: string[];
    lines?: number[];
}
export interface MomentTool {
    key: string;
    titleAr: string;
    titleEn: string;
    evidence: string[];
}
export interface MomentTools {
    generic: MomentTool[];
    sins: Record<string, MomentTool[]>;
    aliases: Record<string, string>;
}
export interface SinProgramsCatalog {
    review: string;
    common: SinProgramsCommon;
    programs: SinProgramEntry[];
    moment: MomentTools;
}
export interface PracticeCatalog {
    occasions: Occasion[];
    habits: Habit[];
    sinPrograms: SinProgramsCatalog;
    deedBranches: Record<string, number[]>;
    stories: Record<string, string | null>;
    mujahada: MujahadaTexts;
}
export declare const MOMENT_TOOLS_MAX = 5;
export declare function buildPracticeCatalog(schedulesText: string, programsText: string): PracticeCatalog;
export declare function practiceCatalog(): PracticeCatalog;
export declare function scheduleForDeed(slug: string): {
    habits: Habit[];
    occasions: Occasion[];
};
export declare function programForSin(slug: string): {
    available: boolean;
    category: SinCategory | null;
};
