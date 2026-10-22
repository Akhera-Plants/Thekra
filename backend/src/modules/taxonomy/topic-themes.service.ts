import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isPublicTopic } from '../classification/public-taxonomy.js';
import { pairForSlug } from './topic-pairs.js';
import { allTopicThemes } from './topic-themes.js';

export interface TopicThemeIndexEntry {
  key: string;
  ar: string;
  en: string;
  /** Normalised chapter phrases behind the theme; lets search match «تارك» as well as «ترك». */
  terms: string[];
  topic: { slug: string; side: 'AVOID' | 'DO' };
  /** Reader pages that show the theme: the topic's own, and its pair's when paired. */
  pages: { sins: string | null; goodDeeds: string | null };
  pageTitleAr: string;
  pageTitleEn: string;
}

@Injectable()
export class TopicThemesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every theme whose topic is public, for the site search (small, static between imports). */
  async index(): Promise<{ data: TopicThemeIndexEntry[] }> {
    const themes = allTopicThemes();
    const slugs = [...new Set(themes.map((theme) => theme.topic))];
    if (slugs.length === 0) return { data: [] };
    const select = { slug: true, name: true, nameAr: true, origin: true, isHidden: true } as const;
    const [sins, deeds] = await Promise.all([
      this.prisma.sin.findMany({ where: { slug: { in: slugs } }, select }),
      this.prisma.goodDeed.findMany({ where: { slug: { in: slugs } }, select }),
    ]);
    const topics = new Map<string, { side: 'AVOID' | 'DO'; name: string; nameAr: string }>();
    for (const row of sins) if (isPublicTopic(row)) topics.set(row.slug, { side: 'AVOID', name: row.name, nameAr: row.nameAr });
    for (const row of deeds) if (isPublicTopic(row)) topics.set(row.slug, { side: 'DO', name: row.name, nameAr: row.nameAr });
    const data: TopicThemeIndexEntry[] = [];
    for (const theme of themes) {
      const topic = topics.get(theme.topic);
      if (!topic) continue;
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
}
