var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isPublicTopic } from '../classification/public-taxonomy.js';
import { pairForSlug } from './topic-pairs.js';
import { allTopicThemes } from './topic-themes.js';
let TopicThemesService = class TopicThemesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async index() {
        const themes = allTopicThemes();
        const slugs = [...new Set(themes.map((theme) => theme.topic))];
        if (slugs.length === 0)
            return { data: [] };
        const select = { slug: true, name: true, nameAr: true, origin: true, isHidden: true };
        const [sins, deeds] = await Promise.all([
            this.prisma.sin.findMany({ where: { slug: { in: slugs } }, select }),
            this.prisma.goodDeed.findMany({ where: { slug: { in: slugs } }, select }),
        ]);
        const topics = new Map();
        for (const row of sins)
            if (isPublicTopic(row))
                topics.set(row.slug, { side: 'AVOID', name: row.name, nameAr: row.nameAr });
        for (const row of deeds)
            if (isPublicTopic(row))
                topics.set(row.slug, { side: 'DO', name: row.name, nameAr: row.nameAr });
        const data = [];
        for (const theme of themes) {
            const topic = topics.get(theme.topic);
            if (!topic)
                continue;
            const pair = pairForSlug(theme.topic);
            data.push({
                key: theme.key,
                ar: theme.ar,
                en: theme.en,
                terms: theme.match,
                topic: { slug: theme.topic, side: topic.side },
                pages: {
                    sins: topic.side === 'AVOID' ? theme.topic : (pair?.avoid ?? null),
                    goodDeeds: topic.side === 'DO' ? theme.topic : (pair?.do ?? null),
                },
                pageTitleAr: pair?.titleAr ?? topic.nameAr,
                pageTitleEn: pair?.titleEn ?? (topic.name || topic.nameAr),
            });
        }
        return { data };
    }
};
TopicThemesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], TopicThemesService);
export { TopicThemesService };
//# sourceMappingURL=topic-themes.service.js.map