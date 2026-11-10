export type NarrationKind = 'MARFU' | 'ATHAR' | 'REJECT';
export interface AtharClassification {
    kind: NarrationKind;
    speakerRaw: string | null;
    saying: string | null;
}
export declare function foldArabic(input: string): string;
export declare function stripOcrNoise(input: string): string;
export declare function classifyNarration(text: string): AtharClassification;
export type AtharStoryRejectReason = 'short' | 'frame-only' | 'ocr' | 'mid-dialogue' | 'content' | 'gap' | 'gesture';
export type AtharAttributionKind = 'SAID' | 'NARRATED';
export interface AtharStoryKept {
    kept: true;
    text: string;
    speakerRaw: string;
    attribution: AtharAttributionKind;
}
export interface AtharStoryRejected {
    kept: false;
    reason: AtharStoryRejectReason;
    text: null;
    speakerRaw: null;
    attribution: null;
}
export type AtharStoryResult = AtharStoryKept | AtharStoryRejected;
export declare function atharContentCue(text: string): string | null;
export declare function extractAtharStory(text: string): AtharStoryResult;
export interface AtharSpeakerEntry {
    key: string;
    ar: string;
    forms: string[];
}
export interface AtharSpeakerMatch {
    key: string;
    ar: string;
}
export declare function matchAtharSpeaker(speakerRaw: string | null | undefined, speakers: readonly AtharSpeakerEntry[]): AtharSpeakerMatch | null;
