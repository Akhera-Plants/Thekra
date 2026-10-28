import { useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { accountsEnabled } from '@/lib/accounts';
import { pushCardState } from '@/lib/push/push-support';
import {
  disablePush,
  enablePush,
  forgetPushConfig,
  loadPushConfig,
  pushDeviceSupport,
  readBrowserPush,
  requestPushPermission,
  sendTestPush,
} from '@/lib/push/web-push';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/types/api';

const noSubscription = () => () => {};

/** The reminders card: which state to show, and its three actions (on, off, test). */
export function usePushReminders() {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const accounts = accountsEnabled();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useSession();
  const device = useSyncExternalStore(noSubscription, pushDeviceSupport, () => 'unknown' as const);

  const config = useQuery({
    queryKey: queryKeys.push.config,
    queryFn: loadPushConfig,
    enabled: accounts,
    staleTime: Infinity,
  });
  const browser = useQuery({
    queryKey: queryKeys.push.browser,
    queryFn: readBrowserPush,
    enabled: accounts && device === 'push' && isAuthenticated,
    staleTime: 0,
  });

  function onSettled(error: unknown) {
    if (error instanceof ApiError && error.code === 'PUSH_DISABLED') {
      forgetPushConfig();
      void queryClient.invalidateQueries({ queryKey: queryKeys.push.config });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.push.browser });
  }

  const enable = useMutation({
    mutationFn: (permission: Promise<NotificationPermission>) => enablePush(locale, permission),
    onSettled: (_data, error) => onSettled(error),
  });
  const disable = useMutation({ mutationFn: disablePush, onSettled: (_data, error) => onSettled(error) });
  const test = useMutation({ mutationFn: () => sendTestPush(locale), onSettled: (_data, error) => onSettled(error) });

  const state = pushCardState({
    accounts,
    device,
    serverEnabled: config.data?.enabled,
    sessionLoading: isLoading,
    signedIn: isAuthenticated,
    browser: browser.data,
  });

  /** The prompt starts here, in the click itself; the mutation only awaits its answer. */
  function turnOn() {
    enable.mutate(requestPushPermission());
  }

  return { state, enable, turnOn, disable, test };
}
