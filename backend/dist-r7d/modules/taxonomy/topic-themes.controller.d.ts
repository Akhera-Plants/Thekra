import { TopicThemesService } from './topic-themes.service.js';
export declare class TopicThemesController {
    private readonly themes;
    constructor(themes: TopicThemesService);
    index(): Promise<{
        data: import("./topic-themes.service.js").TopicThemeIndexEntry[];
    }>;
}
