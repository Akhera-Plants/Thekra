/**
 * رفقة (/v1/circles): fetchers and TanStack Query hooks. Everything here needs a signed-in user; the queries stay
 * disabled without one. Nothing is persisted to AsyncStorage (see PERSISTED_QUERY_KEYS).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api-client';
import { queryKeys } from '../query-keys';
import { useAuthStore } from '../stores/auth-store';
import type {
  CircleDetail,
  CircleSummary,
  CreateCircleInput,
  JoinCircleInput,
  SendCheerInput,
  UpdateMembershipInput,
} from '../types/circles';

// ── Fetchers (one endpoint each) ──────────────────────────────────────────────

const circlePath = (id: string) => `/circles/${encodeURIComponent(id)}`;
/** `skipLang` (read by the api-client interceptor): nothing in a circle is localised by the API. */
const noLang = { skipLang: true } as unknown as AxiosRequestConfig;

export async function fetchCircles(): Promise<CircleSummary[]> {
  return (await apiGet<CircleSummary[]>('/circles', noLang)).data;
}

export async function fetchCircle(id: string, today: string): Promise<CircleDetail> {
  return (await apiGet<CircleDetail>(circlePath(id), { ...noLang, params: { today } })).data;
}

export async function createCircle(input: CreateCircleInput): Promise<CircleDetail> {
  return (await apiPost<CircleDetail>('/circles', input, noLang)).data;
}

export async function joinCircle(input: JoinCircleInput): Promise<CircleDetail> {
  return (await apiPost<CircleDetail>('/circles/join', input, noLang)).data;
}

export async function updateMembership(id: string, input: UpdateMembershipInput) {
  return (await apiPatch<{ displayName: string; sharesPresence: boolean }>(`${circlePath(id)}/membership`, input, noLang)).data;
}

export async function leaveCircle(id: string): Promise<void> {
  await apiDelete(`${circlePath(id)}/membership`, noLang);
}

export async function sendCheer(id: string, input: SendCheerInput): Promise<void> {
  await apiPost<{ id: string }>(`${circlePath(id)}/cheers`, input, noLang);
}

export async function removeMember(id: string, memberId: string): Promise<void> {
  await apiDelete(`${circlePath(id)}/members/${encodeURIComponent(memberId)}`, noLang);
}

export async function rotateInviteCode(id: string): Promise<string> {
  return (await apiPost<{ inviteCode: string }>(`${circlePath(id)}/invite-code`, undefined, noLang)).data.inviteCode;
}

export async function deleteCircle(id: string): Promise<void> {
  await apiDelete(circlePath(id), noLang);
}

/** «حضرت اليوم» in every circle where the user shares; idempotent on the server. */
export async function markPresence(date: string): Promise<void> {
  await apiPut<{ circles: number }>('/circles/presence', { date }, noLang);
}

export async function clearPresence(date: string): Promise<void> {
  await apiDelete(`/circles/presence/${encodeURIComponent(date)}`, noLang);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** The signed-in user's id (client-side only, for cache keys), or null. */
export function useCircleUserId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

export function useMyCircles() {
  const userId = useCircleUserId();
  return useQuery({
    queryKey: queryKeys.circles.list(userId ?? ''),
    queryFn: fetchCircles,
    enabled: userId !== null,
  });
}

export function useCircle(id: string, today: string) {
  const userId = useCircleUserId();
  return useQuery({
    queryKey: [...queryKeys.circles.detail(userId ?? '', id), today],
    queryFn: () => fetchCircle(id, today),
    enabled: userId !== null && id.length > 0,
  });
}

function useInvalidateCircles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.circles.all });
}

export function useCreateCircle() {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: createCircle, onSuccess: invalidate });
}

export function useJoinCircle() {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: joinCircle, onSuccess: invalidate });
}

export function useUpdateMembership(id: string) {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: (input: UpdateMembershipInput) => updateMembership(id, input), onSuccess: invalidate });
}

export function useSendCheer(id: string) {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: (input: SendCheerInput) => sendCheer(id, input), onSettled: invalidate });
}

/** After leaving or deleting, the circle's own cache is dropped (a refetch would only answer 404). */
function useForgetCircle(id: string) {
  const qc = useQueryClient();
  const userId = useCircleUserId();
  return () => {
    qc.removeQueries({ queryKey: queryKeys.circles.detail(userId ?? '', id) });
    return qc.invalidateQueries({ queryKey: queryKeys.circles.all });
  };
}

export function useLeaveCircle(id: string) {
  const forget = useForgetCircle(id);
  return useMutation({ mutationFn: () => leaveCircle(id), onSuccess: forget });
}

export function useRemoveMember(id: string) {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: (memberId: string) => removeMember(id, memberId), onSuccess: invalidate });
}

export function useRotateInviteCode(id: string) {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: () => rotateInviteCode(id), onSuccess: invalidate });
}

export function useDeleteCircle(id: string) {
  const forget = useForgetCircle(id);
  return useMutation({ mutationFn: () => deleteCircle(id), onSuccess: forget });
}
