export interface TopicTheme {
    topic: string;
    key: string;
    ar: string;
    en: string;
    match: string[];
    order: number;
}
export declare const THEME_KEY_PATTERN: RegExp;
export declare const MAX_THEMES_PER_TOPIC = 8;
export declare function normTheme(value: string): string;
export declare function parseTopicThemes(source: string): TopicTheme[];
export declare function chapterTitleFromNote(note: string | null | undefined): string | null;
export declare function isGenericTitle(title: string): boolean;
export declare function themeHaystack(input: {
    note: string | null;
    sectionTitle: string | null;
    parentTitles: readonly string[];
}): string;
export declare function matchThemeKeys(themes: readonly TopicTheme[], haystack: string): string[];
export declare function topicThemesPath(): string;
export declare function resetTopicThemesCache(): void;
export declare function allTopicThemes(): readonly TopicTheme[];
export declare function themesForTopics(slugs: readonly string[]): TopicTheme[];
export declare function themeByKey(key: string): TopicTheme | null;
