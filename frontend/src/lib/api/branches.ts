import { apiGet } from '@/lib/api-client';
import type { CountsByKind, PageMeta, QuoteDto, QuoteKind } from '@/lib/types/api';

export interface ImanBranchDto {
  id: string;
  number: number;
  titleAr: string;
  title: string | null;
  summaryAr: string | null;
  summary: string | null;
  quoteCount: number;
  source: { id: string; name: string; nameAr: string | null } | null;
  sourceReference: string | null;
}

export interface ImanBranchDetailDto extends ImanBranchDto {
  explanations: Array<{
    id: string;
    kind: string;
    languageCode: string;
    text: string;
    reference: string | null;
  }>;
  goodDeeds: Array<{ slug: string; name: string; nameAr: string }>;
  sins: Array<{ slug: string; name: string; nameAr: string; rank: string | null }>;
  prev: { number: number; titleAr: string; title: string | null } | null;
  next: { number: number; titleAr: string; title: string | null } | null;
}

export interface BranchQuotesMeta extends PageMeta {
  ordering?: string;
  countsByType?: Record<string, number>;
  countsByKind?: CountsByKind;
  appliedGrades?: string[];
}

export interface BranchQuotesResponse {
  branch: {
    number: number;
    titleAr: string;
    title: string | null;
    summaryAr: string | null;
  };
  items: Array<{
    link: { id: string; relevanceScore: number | null; note: string | null };
    quote: QuoteDto;
  }>;
}

export async function getBranches(query: { page?: number; limit?: number; lang?: string } = {}) {
  return apiGet<ImanBranchDto[]>('/branches', { params: query });
}

export async function getBranch(number: number, lang?: string) {
  return apiGet<ImanBranchDetailDto>(`/branches/${number}`, {
    params: lang ? { lang } : undefined,
  });
}

export interface BranchQuotesQuery {
  page?: number;
  limit?: number;
  lang?: string;
  kind?: QuoteKind;
}

export async function getBranchQuotes(number: number, query: BranchQuotesQuery = {}) {
  return apiGet<BranchQuotesResponse>(`/branches/${number}/quotes`, { params: query });
}
