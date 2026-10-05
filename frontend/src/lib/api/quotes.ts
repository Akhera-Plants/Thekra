import { apiGet } from '@/lib/api-client';
import type { QuoteDetailDto, QuoteDetailQuery, QuoteDto, QuotesQuery } from '@/lib/types/api';

export async function getQuotes(query: QuotesQuery = {}) {
  return apiGet<QuoteDto[]>('/quotes', { params: query });
}

export async function getQuote(id: string, query: QuoteDetailQuery = {}) {
  return apiGet<QuoteDetailDto>(`/quotes/${id}`, { params: query });
}
