/**
 * Auth store — Zustand slice for session state.
 * Same tiny-store discipline as frontend-plan §6.6.
 *
 * Access token lives in api-client.ts (module-level, never persisted).
 * Refresh token lives in expo-secure-store (see api-client.ts).
 * This store holds only the derived session UI state.
 */

import { create } from 'zustand';
import {
  setAccessToken,
  saveRefreshToken,
  clearRefreshToken,
  loadRefreshToken,
} from '../api-client';
import { loginUser, registerUser, logoutUser, fetchMe } from '../api/auth';
import type { UserDto, LoginDto, RegisterDto } from '../types/api';

interface AuthState {
  user: UserDto | null;
  isLoading: boolean;
  error: string | null;

  /** Called on app launch to rehydrate from SecureStore. */
  rehydrate: () => Promise<void>;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  /** Drops the session locally without calling /auth/logout (e.g. after the account was deleted). */
  clearSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  rehydrate: async () => {
    set({ isLoading: true });
    try {
      const stored = await loadRefreshToken();
      if (!stored) {
        set({ isLoading: false });
        return;
      }
      // Exchange the stored refresh token for a new access token.
      const { performRefresh } = await import('../api-client');
      const newToken = await performRefresh();
      if (newToken) {
        const me = await fetchMe();
        set({ user: me, isLoading: false });
      } else {
        // Refresh token is stale — user must log in again
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await loginUser(dto);
      setAccessToken(tokens.accessToken);
      if (tokens.refreshToken) {
        await saveRefreshToken(tokens.refreshToken);
      }
      set({ user: tokens.user, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      set({ error: msg, isLoading: false });
      throw e;
    }
  },

  register: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await registerUser(dto);
      setAccessToken(tokens.accessToken);
      if (tokens.refreshToken) {
        await saveRefreshToken(tokens.refreshToken);
      }
      set({ user: tokens.user, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      set({ error: msg, isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await logoutUser();
    await get().clearSession();
  },

  clearSession: async () => {
    setAccessToken(null);
    await clearRefreshToken();
    // Forget the account link of the practice sync and lock the sin vault (in-memory key and keystore entry);
    // the practice data on this device is kept (local-first).
    const { clearSyncMeta } = await import('../practice/sync-runner');
    const { lockVault } = await import('../practice/vault-runner');
    await clearSyncMeta();
    await lockVault();
    set({ user: null, isLoading: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
