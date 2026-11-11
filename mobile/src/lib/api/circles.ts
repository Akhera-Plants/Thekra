/**
 * صحبة (/v1/circles): fetchers and TanStack Query hooks. Everything here needs a signed-in user; the queries stay
 * disabled without one. Nothing is persisted to AsyncStorage (see PERSISTED_QUERY_KEYS).
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api-client';
import { queryKeys } from '../query-keys';
import { useAuthStore } from '../stores/auth-store';
import type {
  CircleAccess,
  CircleDetail,
  CircleInvite,
  CircleMessage,
  CircleMessagesPage,
  CircleRound,
  CircleSummary,
  ReportInput,
  RoundReplyKey,
  SendMessageInput,
  StartRoundInput,
  RedeemInviteResult,
  CreateCircleInput,
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

export async function updateMembership(id: string, input: UpdateMembershipInput) {
  return (await apiPatch<{ displayName: string; sharesPresence: boolean }>(`${circlePath(id)}/membership`, input, noLang)).data;
}

export async function leaveCircle(id: string): Promise<void> {
  await apiDelete(`${circlePath(id)}/membership`, noLang);
}

// ── Round 7: the feed, rounds, keep, report, hide ─────────────────────────────

export const FEED_PAGE_SIZE = 30;

export async function fetchMessages(id: string, opts: { before?: string; saved?: boolean }): Promise<CircleMessagesPage> {
  const params: Record<string, string | number> = { limit: FEED_PAGE_SIZE };
  if (opts.before) params.before = opts.before;
  if (opts.saved) params.saved = 'true';
  return (await apiGet<CircleMessagesPage>(`${circlePath(id)}/messages`, { ...noLang, params })).data;
}

export async function sendMessage(id: string, input: SendMessageInput): Promise<CircleMessage> {
  return (await apiPost<CircleMessage>(`${circlePath(id)}/messages`, input, noLang)).data;
}

export async function startRound(id: string, input: StartRoundInput): Promise<CircleRound> {
  return (await apiPost<CircleRound>(`${circlePath(id)}/rounds`, input, noLang)).data;
}

export async function endRound(id: string, roundId: string, outcome: 'done' | 'not_done'): Promise<CircleRound> {
  return (await apiPost<CircleRound>(`${circlePath(id)}/rounds/${encodeURIComponent(roundId)}/end`, { outcome }, noLang)).data;
}

export async function replyToRound(id: string, roundId: string, key: RoundReplyKey): Promise<CircleMessage> {
  return (await apiPost<CircleMessage>(`${circlePath(id)}/rounds/${encodeURIComponent(roundId)}/replies`, { key }, noLang)).data;
}

export async function setMessageKept(id: string, messageId: string, kept: boolean): Promise<void> {
  const path = `${circlePath(id)}/messages/${encodeURIComponent(messageId)}/save`;
  if (kept) await apiPut(path, undefined, noLang);
  else await apiDelete(path, noLang);
}

export async function reportInCircle(id: string, input: ReportInput): Promise<{ received: true; muted: boolean }> {
  return (await apiPost<{ received: true; muted: boolean }>(`${circlePath(id)}/reports`, input, noLang)).data;
}

export async function setMemberMuted(id: string, memberId: string, muted: boolean): Promise<void> {
  const path = `${circlePath(id)}/mutes/${encodeURIComponent(memberId)}`;
  if (muted) await apiPut(path, undefined, noLang);
  else await apiDelete(path, noLang);
}

export async function removeMember(id: string, memberId: string): Promise<void> {
  await apiDelete(`${circlePath(id)}/members/${encodeURIComponent(memberId)}`, noLang);
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

export function useUpdateMembership(id: string) {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: (input: UpdateMembershipInput) => updateMembership(id, input), onSuccess: invalidate });
}

/** The feed polls while the screen is open (no sockets): new lines show within this many milliseconds. */
export const FEED_POLL_MS = 20_000;

/**
 * «رسائل الصحبة»: pages of 30, newest first from the API (the screen shows them oldest at the top). `saved` reads
 * «المحفوظة» only. Polls while mounted and focused.
 */
export function useCircleMessages(id: string, saved: boolean) {
  const userId = useCircleUserId();
  return useInfiniteQuery({
    queryKey: [...queryKeys.circles.detail(userId ?? '', id), 'messages', saved ? 'saved' : 'all'],
    queryFn: ({ pageParam }) => fetchMessages(id, { before: pageParam, saved }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: userId !== null && id.length > 0,
    refetchInterval: saved ? false : FEED_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** Everything under this circle (its detail, its feed pages) is refetched after a write. */
function useInvalidateCircle(id: string) {
  const qc = useQueryClient();
  const userId = useCircleUserId();
  return () => qc.invalidateQueries({ queryKey: queryKeys.circles.detail(userId ?? '', id) });
}

export function useSendMessage(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({ mutationFn: (input: SendMessageInput) => sendMessage(id, input), onSettled: invalidate });
}

export function useStartRound(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({ mutationFn: (input: StartRoundInput) => startRound(id, input), onSettled: invalidate });
}

export function useEndRound(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({
    mutationFn: ({ roundId, outcome }: { roundId: string; outcome: 'done' | 'not_done' }) => endRound(id, roundId, outcome),
    onSettled: invalidate,
  });
}

export function useReplyToRound(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({
    mutationFn: ({ roundId, key }: { roundId: string; key: RoundReplyKey }) => replyToRound(id, roundId, key),
    onSettled: invalidate,
  });
}

export function useKeepMessage(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({
    mutationFn: ({ messageId, kept }: { messageId: string; kept: boolean }) => setMessageKept(id, messageId, kept),
    onSettled: invalidate,
  });
}

export function useReport(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({ mutationFn: (input: ReportInput) => reportInCircle(id, input), onSettled: invalidate });
}

export function useMuteMember(id: string) {
  const invalidate = useInvalidateCircle(id);
  return useMutation({
    mutationFn: ({ memberId, muted }: { memberId: string; muted: boolean }) => setMemberMuted(id, memberId, muted),
    onSettled: invalidate,
  });
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

export function useDeleteCircle(id: string) {
  const forget = useForgetCircle(id);
  return useMutation({ mutationFn: () => deleteCircle(id), onSuccess: forget });
}

// ── Invites (round 6, C-01k: صحبة is invite-only) ──────────────────────────────

export async function fetchCircleAccess(): Promise<CircleAccess> {
  return (await apiGet<CircleAccess>('/circles/access', noLang)).data;
}

export async function fetchMyInvites(): Promise<CircleInvite[]> {
  return (await apiGet<CircleInvite[]>('/circles/invites', noLang)).data;
}

export async function createInvite(circleId?: string): Promise<CircleInvite> {
  return (await apiPost<CircleInvite>('/circles/invites', circleId ? { circleId } : {}, noLang)).data;
}

export async function revokeInvite(id: string): Promise<void> {
  await apiDelete(`/circles/invites/${encodeURIComponent(id)}`, noLang);
}

export async function redeemInvite(input: { code: string; displayName?: string }): Promise<RedeemInviteResult> {
  return (await apiPost<RedeemInviteResult>('/circles/invites/redeem', input, noLang)).data;
}

/** Whether صحبة is on for me (a personal invite turns it on). */
export function useCircleAccess() {
  const userId = useCircleUserId();
  return useQuery({
    queryKey: [...queryKeys.circles.all, userId ?? '', 'access'],
    queryFn: fetchCircleAccess,
    enabled: userId !== null,
  });
}

export function useMyInvites(enabled: boolean) {
  const userId = useCircleUserId();
  return useQuery({
    queryKey: [...queryKeys.circles.all, userId ?? '', 'invites'],
    queryFn: fetchMyInvites,
    enabled: userId !== null && enabled,
  });
}

export function useCreateInvite() {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: (circleId?: string) => createInvite(circleId), onSettled: invalidate });
}

export function useRevokeInvite() {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: revokeInvite, onSettled: invalidate });
}

export function useRedeemInvite() {
  const invalidate = useInvalidateCircles();
  return useMutation({ mutationFn: redeemInvite, onSuccess: invalidate });
}
