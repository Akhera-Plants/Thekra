/**
 * useToggleFavorite — optimistic add/remove with full rollback.
 *
 * When the user is NOT authenticated:
 *   - Does not call the API
 *   - Calls the provided `onRequireAuth` callback (to show a SignInPrompt)
 *
 * When authenticated:
 *   1. Optimistically flips `ids` in `favorites.quoteIds` cache
 *   2. On error, rolls back the snapshot and shows an error toast
 *   3. On settle, invalidates `favorites.all` + `favorites.quoteIds`
 *   4. Shows a success toast
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { addFavorite, removeFavorite } from '@/lib/api/favorites';
import { queryKeys } from '@/lib/query-keys';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/features/auth/hooks/useSession';
import { ApiError } from '@/lib/types/api';

interface UseToggleFavoriteOptions {
  /** Called instead of the API when the user is not authenticated. */
  onRequireAuth?: () => void;
  labels?: {
    added: string;
    removed: string;
    error: string;
    authRequired: string;
  };
}

export function useToggleFavorite(options?: UseToggleFavoriteOptions) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const tAuth = useTranslations('auth');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      quoteId,
      wasFavorited,
    }: {
      quoteId: string;
      wasFavorited: boolean;
    }) => {
      if (wasFavorited) {
        await removeFavorite(quoteId);
      } else {
        await addFavorite(quoteId);
      }
      return { quoteId, wasFavorited };
    },

    onMutate: async ({ quoteId, wasFavorited }) => {
      // Cancel in-flight refetches so they don't stomp our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites.quoteIds });

      // Snapshot current ids for rollback
      const previousIds = queryClient.getQueryData<string[]>(
        queryKeys.favorites.quoteIds,
      );

      // Optimistically update
      queryClient.setQueryData<string[]>(
        queryKeys.favorites.quoteIds,
        (old) => {
          const current = old ?? [];
          if (wasFavorited) {
            return current.filter((id) => id !== quoteId);
          } else {
            return [...current, quoteId];
          }
        },
      );

      return { previousIds };
    },

    onError: (_err, _vars, context) => {
      // Roll back
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(queryKeys.favorites.quoteIds, context.previousIds);
      }

      const errMsg = _err instanceof ApiError ? _err.message : options?.labels?.error ?? 'حدث خطأ';
      toast.error(options?.labels?.error ?? errMsg);
    },

    onSuccess: (_data, { wasFavorited }) => {
      const msg = wasFavorited
        ? (options?.labels?.removed ?? 'تم الحذف من المفضلة')
        : (options?.labels?.added ?? 'تمت الإضافة إلى المفضلة');
      toast.success(msg);
    },

    onSettled: () => {
      // Always sync the server truth
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.quoteIds });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
    },
  });

  /**
   * Safe toggle — handles auth gate transparently.
   */
  function toggle(quoteId: string, currentlyFavorited: boolean) {
    if (!isAuthenticated) {
      if (options?.onRequireAuth) {
        options.onRequireAuth();
      } else {
        // A notice with its way out: «سجّل الدخول» (owner round 8, item 1), coming back to this page afterwards.
        const here = `${window.location.pathname}${window.location.search}`;
        toast.info(options?.labels?.authRequired ?? 'سجّل دخولك لحفظ المفضلة', {
          action: {
            label: tAuth('signInNow'),
            onClick: () => router.push({ pathname: '/login', query: { why: 'bookmark', next: stripLocale(here) } }),
          },
        });
      }
      return;
    }
    mutation.mutate({ quoteId, wasFavorited: currentlyFavorited });
  }

  return {
    toggle,
    isPending: mutation.isPending,
  };
}

/** The path without its locale prefix (`/en/quotes/1` → `/quotes/1`), the form `?next=` and the router use. */
function stripLocale(path: string): string {
  return path.replace(/^\/en(?=\/|$)/, '') || '/';
}
