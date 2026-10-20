import { apiGet } from '@/lib/api-client';
import type { ExplanationRow } from './lib/tabs';

export async function getExplanations(quoteId: string, lang?: 'ar' | 'en') {
  return apiGet<ExplanationRow[]>(`/quotes/${quoteId}/explanations`, {
    params: lang ? { lang } : undefined,
  });
}
