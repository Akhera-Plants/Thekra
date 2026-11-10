var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { HomeMomentTopic, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isPublicTopic } from '../classification/public-taxonomy.js';
import { readHomeMomentsSeed } from './home-moments-yaml.js';
const TYPE_KEY = { SIN: 'sin', GOOD_DEED: 'good-deed', BRANCH: 'branch' };
const PATH_PREFIX = { SIN: '/sins', GOOD_DEED: '/good-deeds', BRANCH: '/branches' };
const notFound = () => new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Home moment not found' });
let HomeMomentsService = class HomeMomentsService {
    prisma;
    seed = null;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findPublic(locale) {
        const rows = await this.prisma.homeMoment.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
        const source = rows.length > 0 ? 'database' : 'seed';
        const list = (rows.length > 0 ? rows : this.seedRows()).filter((row) => row.published);
        const titles = await this.topicTitles(list, locale);
        const data = list.flatMap((row) => {
            const title = titles.get(`${row.topicType}:${row.topicSlug}`);
            if (title === undefined)
                return [];
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
    async adminList() {
        return { data: await this.prisma.homeMoment.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }) };
    }
    async adminCreate(dto) {
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
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ code: 'RESOURCE_CONFLICT', message: `A moment with key "${dto.key}" exists` });
            }
            throw error;
        }
    }
    async adminUpdate(id, dto) {
        const current = await this.prisma.homeMoment.findUnique({ where: { id } });
        if (!current)
            throw notFound();
        if (dto.topicType !== undefined || dto.topicSlug !== undefined) {
            await this.assertTopic(dto.topicType ?? current.topicType, dto.topicSlug ?? current.topicSlug);
        }
        const data = {
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
    async adminDelete(id) {
        const { count } = await this.prisma.homeMoment.deleteMany({ where: { id } });
        if (count === 0)
            throw notFound();
    }
    seedRows() {
        this.seed ??= readHomeMomentsSeed();
        return this.seed;
    }
    async topicTitles(rows, locale) {
        const slugs = (type) => [...new Set(rows.filter((row) => row.topicType === type).map((row) => row.topicSlug))];
        const sinSlugs = slugs(HomeMomentTopic.SIN);
        const deedSlugs = slugs(HomeMomentTopic.GOOD_DEED);
        const branchNumbers = slugs(HomeMomentTopic.BRANCH).map(Number).filter((n) => Number.isInteger(n) && n > 0);
        const select = { slug: true, name: true, nameAr: true, origin: true, isHidden: true };
        const [sins, deeds, branches] = await Promise.all([
            sinSlugs.length ? this.prisma.sin.findMany({ where: { slug: { in: sinSlugs } }, select }) : [],
            deedSlugs.length ? this.prisma.goodDeed.findMany({ where: { slug: { in: deedSlugs } }, select }) : [],
            branchNumbers.length
                ? this.prisma.imanBranch.findMany({ where: { number: { in: branchNumbers } }, select: { number: true, titleAr: true, title: true } })
                : [],
        ]);
        const titles = new Map();
        for (const sin of sins)
            if (isPublicTopic(sin))
                titles.set(`SIN:${sin.slug}`, locale === 'en' ? sin.name : sin.nameAr);
        for (const deed of deeds)
            if (isPublicTopic(deed))
                titles.set(`GOOD_DEED:${deed.slug}`, locale === 'en' ? deed.name : deed.nameAr);
        for (const branch of branches) {
            const title = locale === 'en' ? branch.title : branch.titleAr;
            if (title)
                titles.set(`BRANCH:${branch.number}`, title);
        }
        return titles;
    }
    async assertTopic(type, slug) {
        const found = type === HomeMomentTopic.SIN
            ? await this.prisma.sin.count({ where: { slug } })
            : type === HomeMomentTopic.GOOD_DEED
                ? await this.prisma.goodDeed.count({ where: { slug } })
                : /^[1-9][0-9]?$/.test(slug) ? await this.prisma.imanBranch.count({ where: { number: Number(slug) } }) : 0;
        if (found === 0) {
            throw new UnprocessableEntityException({ code: 'RELATED_RESOURCE_INVALID', message: `No ${TYPE_KEY[type]} "${slug}"` });
        }
    }
};
HomeMomentsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], HomeMomentsService);
export { HomeMomentsService };
//# sourceMappingURL=home-moments.service.js.map