import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { HomeMomentTopic, Prisma, type HomeMoment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isPublicTopic } from '../classification/public-taxonomy.js';
import type { CreateHomeMomentDto, UpdateHomeMomentDto } from './dto/home-moment.dto.js';
import { readHomeMomentsSeed, type HomeMomentSeed } from './home-moments-yaml.js';

export type MomentTopicType = 'sin' | 'good-deed' | 'branch';

/** One row of GET /home-moments, in the requested language. */
export interface HomeMomentDto {
  key: string;
  /** Help for the moment («تعينك على التخفّف من الغضب»). */
  label: string;
  /** The situation line («قبل أن تردّ وأنت غاضب»), or null. */
  situation: string | null;
  icon: string;
  topic: { type: MomentTopicType; slug: string; title: string; path: string };
}

const TYPE_KEY: Record<HomeMomentTopic, MomentTopicType> = { SIN: 'sin', GOOD_DEED: 'good-deed', BRANCH: 'branch' };
const PATH_PREFIX: Record<HomeMomentTopic, string> = { SIN: '/sins', GOOD_DEED: '/good-deeds', BRANCH: '/branches' };

type MomentRow = Pick<HomeMoment, 'key' | 'topicType' | 'topicSlug' | 'labelAr' | 'labelEn' | 'situationAr' | 'situationEn' | 'icon' | 'sortOrder' | 'published'>;

const notFound = () => new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Home moment not found' });

/**
 * «في لحظات مثل هذه» (round 6, C-09): one list for every user, managed by us. The HomeMoment table is the live
 * list (desk: /v1/admin/home-moments; seed: home-moments:import); while it is empty the YAML seed built into the
 * bundle is served instead. A row whose topic is missing or hidden is left out.
 */
@Injectable()
export class HomeMomentsService {
  private seed: HomeMomentSeed[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async findPublic(locale: 'ar' | 'en'): Promise<{ data: HomeMomentDto[]; meta: { locale: string; source: 'database' | 'seed' } }> {
    const rows = await this.prisma.homeMoment.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
    const source = rows.length > 0 ? 'database' : 'seed';
    const list: MomentRow[] = (rows.length > 0 ? rows : this.seedRows()).filter((row) => row.published);
    const titles = await this.topicTitles(list, locale);
    const data = list.flatMap((row) => {
      const title = titles.get(`${row.topicType}:${row.topicSlug}`);
      if (title === undefined) return [];
      return [{
        key: row.key,
        label: locale === 'en' ? row.labelEn : row.labelAr,
        situation: (locale === 'en' ? row.situationEn : row.situationAr) ?? null,
        icon: row.icon,
        topic: { type: TYPE_KEY[row.topicType], slug: row.topicSlug, title, path: `${PATH_PREFIX[row.topicType]}/${row.topicSlug}` },
      }];
    });
    return { data, meta: { locale, source } };
  }

  // ── Desk ───────────────────────────────────────────────────────────────────

  async adminList(): Promise<{ data: HomeMoment[] }> {
    return { data: await this.prisma.homeMoment.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }) };
  }

  async adminCreate(dto: CreateHomeMomentDto): Promise<HomeMoment> {
    await this.assertTopic(dto.topicType, dto.topicSlug);
    try {
      return await this.prisma.homeMoment.create({
        data: {
          key: dto.key,
          topicType: dto.topicType,
          topicSlug: dto.topicSlug,
          labelAr: dto.labelAr,
          labelEn: dto.labelEn,
          situationAr: dto.situationAr ?? null,
          situationEn: dto.situationEn ?? null,
          icon: dto.icon,
          sortOrder: dto.sortOrder ?? 0,
          published: dto.published ?? true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'RESOURCE_CONFLICT', message: `A moment with key "${dto.key}" exists` });
      }
      throw error;
    }
  }

  async adminUpdate(id: string, dto: UpdateHomeMomentDto): Promise<HomeMoment> {
    const current = await this.prisma.homeMoment.findUnique({ where: { id } });
    if (!current) throw notFound();
    if (dto.topicType !== undefined || dto.topicSlug !== undefined) {
      await this.assertTopic(dto.topicType ?? current.topicType, dto.topicSlug ?? current.topicSlug);
    }
    const data: Prisma.HomeMomentUpdateInput = {
      topicType: dto.topicType,
      topicSlug: dto.topicSlug,
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      situationAr: dto.situationAr,
      situationEn: dto.situationEn,
      icon: dto.icon,
      sortOrder: dto.sortOrder,
      published: dto.published,
    };
    return this.prisma.homeMoment.update({ where: { id }, data });
  }

  async adminDelete(id: string): Promise<void> {
    const { count } = await this.prisma.homeMoment.deleteMany({ where: { id } });
    if (count === 0) throw notFound();
  }

  private seedRows(): HomeMomentSeed[] {
    this.seed ??= readHomeMomentsSeed();
    return this.seed;
  }

  /** `TYPE:slug` → the topic's title in `locale`, for public topics only (one query per topic kind present). */
  private async topicTitles(rows: MomentRow[], locale: 'ar' | 'en'): Promise<Map<string, string>> {
    const slugs = (type: HomeMomentTopic) => [...new Set(rows.filter((row) => row.topicType === type).map((row) => row.topicSlug))];
    const sinSlugs = slugs(HomeMomentTopic.SIN);
    const deedSlugs = slugs(HomeMomentTopic.GOOD_DEED);
    const branchNumbers = slugs(HomeMomentTopic.BRANCH).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const select = { slug: true, name: true, nameAr: true, origin: true, isHidden: true } as const;
    const [sins, deeds, branches] = await Promise.all([
      sinSlugs.length ? this.prisma.sin.findMany({ where: { slug: { in: sinSlugs } }, select }) : [],
      deedSlugs.length ? this.prisma.goodDeed.findMany({ where: { slug: { in: deedSlugs } }, select }) : [],
      branchNumbers.length
        ? this.prisma.imanBranch.findMany({ where: { number: { in: branchNumbers } }, select: { number: true, titleAr: true, title: true } })
        : [],
    ]);
    const titles = new Map<string, string>();
    for (const sin of sins) if (isPublicTopic(sin)) titles.set(`SIN:${sin.slug}`, locale === 'en' ? sin.name : sin.nameAr);
    for (const deed of deeds) if (isPublicTopic(deed)) titles.set(`GOOD_DEED:${deed.slug}`, locale === 'en' ? deed.name : deed.nameAr);
    // A branch without an English title keeps the Arabic one only in the Arabic list (no machine translation).
    for (const branch of branches) {
      const title = locale === 'en' ? branch.title : branch.titleAr;
      if (title) titles.set(`BRANCH:${branch.number}`, title);
    }
    return titles;
  }

  private async assertTopic(type: HomeMomentTopic, slug: string): Promise<void> {
    const found = type === HomeMomentTopic.SIN
      ? await this.prisma.sin.count({ where: { slug } })
      : type === HomeMomentTopic.GOOD_DEED
        ? await this.prisma.goodDeed.count({ where: { slug } })
        : /^[1-9][0-9]?$/.test(slug) ? await this.prisma.imanBranch.count({ where: { number: Number(slug) } }) : 0;
    if (found === 0) {
      throw new UnprocessableEntityException({ code: 'RELATED_RESOURCE_INVALID', message: `No ${TYPE_KEY[type]} "${slug}"` });
    }
  }
}
