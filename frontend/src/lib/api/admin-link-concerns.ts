/**
 * Links the content team flagged «لا علاقة حقيقية» (round 8, B5). Backend: GET /admin/link-concerns, and the
 * link PATCH of each kind for the decision. «أبقِ الربط» accepts the link and clears the flag; «اخفِ الربط» rejects it
 * (readers no longer see it) and keeps the flag as the record.
 */
import { apiClient, apiPatch } from '@/lib/api-client';
import type { LinkConcernDecision, LinkConcernKind, LinkConcernsPage } from '@/lib/types/admin';

const PATCH_PATH: Record<LinkConcernKind, string> = {
  sin: '/admin/sin-quotes',
  'good-deed': '/admin/good-deed-quotes',
  branch: '/admin/branch-quotes',
};

export interface LinkConcernsQuery {
  kind: LinkConcernKind;
  decision: LinkConcernDecision;
  topicId?: string;
  offset: number;
  limit: number;
}

export async function getLinkConcerns(query: LinkConcernsQuery): Promise<LinkConcernsPage> {
  const response = await apiClient.get<LinkConcernsPage>('/admin/link-concerns', { params: query, skipLang: true } as object);
  return response.data;
}

export async function decideLinkConcern(kind: LinkConcernKind, linkId: string, decision: 'keep' | 'hide'): Promise<void> {
  const body = decision === 'keep' ? { reviewStatus: 'ACCEPTED', concern: null } : { reviewStatus: 'REJECTED' };
  await apiPatch(`${PATCH_PATH[kind]}/${linkId}`, body, { skipLang: true } as object);
}
