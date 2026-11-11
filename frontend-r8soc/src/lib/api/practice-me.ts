/**
 * Signed-in practice endpoints (docs/plan/2026-10-practice-sync-contract.md §3): sync, the encrypted sin vault,
 * and the account's export and deletion. Every call carries the in-memory access token (api-client); the
 * 401 → refresh → retry flow is the api-client's own.
 *
 * Privacy: the sync body comes only from practice-core `buildSyncRequest` (never programs); the vault body is
 * ciphertext from `vaultPayload`. Nothing else here carries practice data.
 */
import type { SyncRequest, SyncResponse, VaultPayload } from '@thekra/practice-core';
import { apiClient, apiDelete, apiGet, apiPost } from '@/lib/api-client';
import type { ApiEnvelope } from '@/lib/types/api';

/** Practice data has no language: no `?lang=` (the api-client adds it to every request unless told not to). */
const NO_LANG = { skipLang: true } as Record<string, unknown>;

export interface ServerVault {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf: string;
  iterations: number;
  version: number;
  updatedAt: string;
}

export async function postPracticeSync(body: SyncRequest): Promise<SyncResponse> {
  return (await apiPost<SyncResponse>('/me/practice/sync', body, NO_LANG)).data;
}

export async function getSinVault(): Promise<ServerVault | null> {
  return (await apiGet<{ vault: ServerVault | null }>('/me/sin-vault', NO_LANG)).data.vault;
}

/** Stale `version` → ApiError 409 `SIN_VAULT_CONFLICT`. */
export async function putSinVault(body: VaultPayload): Promise<number> {
  const response = await apiClient.put<ApiEnvelope<{ version: number }>>('/me/sin-vault', body, NO_LANG);
  return response.data.data.version;
}

export async function deleteSinVault(): Promise<void> {
  await apiDelete('/me/sin-vault', NO_LANG);
}

/** Everything stored for the account (the vault only as ciphertext). */
export async function getAccountExport(): Promise<unknown> {
  return (await apiGet<unknown>('/auth/me/export', NO_LANG)).data;
}

/** Wrong password → ApiError 401 `INVALID_CREDENTIALS`. */
export async function deleteAccount(password: string): Promise<void> {
  await apiDelete('/auth/me', { ...NO_LANG, data: { password } });
}
