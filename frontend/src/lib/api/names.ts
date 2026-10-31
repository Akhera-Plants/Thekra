import { apiGet } from '@/lib/api-client';
import type { QuoteDto } from '@/lib/types/api';

/** GET /v1/names-of-allah — one Name of Allah in the list (names-of-allah.yaml order). */
export interface NameOfAllahDto {
  number: number;
  slug: string;
  nameAr: string;
  /** `surah:ayah` of the verse that contains the name. */
  ref: string;
}

export interface NameLinkDto {
  /** `deed` → /good-deeds/:slug, `sin` → /sins/:slug, `action` → an in-app action (leave-sin → «تخفَّف»). */
  kind: 'deed' | 'sin' | 'action';
  slug: string;
  nameAr: string;
  name: string;
}

/** GET /v1/names-of-allah/:slug */
export interface NameOfAllahDetailDto extends NameOfAllahDto {
  meaningAr: string;
  meaningEn: string;
  /** `pending-sheikh` while the meanings and links are under review. */
  review: string;
  /** The verse that contains the name, from the database; null when it is not published. */
  verse: QuoteDto | null;
  links: NameLinkDto[];
  /** Up to 10 more published verses with the word, by surah/ayah. */
  otherVerses: QuoteDto[];
  prev: NameOfAllahDto | null;
  next: NameOfAllahDto | null;
}

export async function getNamesOfAllah() {
  return apiGet<NameOfAllahDto[]>('/names-of-allah');
}

export async function getNameOfAllah(slug: string, lang?: string) {
  return apiGet<NameOfAllahDetailDto>(`/names-of-allah/${encodeURIComponent(slug)}`, {
    params: lang ? { lang } : undefined,
  });
}

/** Client route of a name link. */
export function nameLinkHref(link: Pick<NameLinkDto, 'kind' | 'slug'>): string {
  if (link.kind === 'deed') return `/good-deeds/${link.slug}`;
  if (link.kind === 'sin') return `/sins/${link.slug}`;
  return '/practice/leave-sin';
}
