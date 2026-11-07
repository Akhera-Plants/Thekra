/**
 * Shown instead of a blank screen when a screen throws while rendering (round-5 QA): the kit's error state with
 * «حاول مجددًا», which re-renders the route. Exported as `ErrorBoundary` from the tab and practice layouts, inside the
 * theme and i18n providers of the root layout.
 */
import React from 'react';
import type { ErrorBoundaryProps } from 'expo-router';
import { ErrorState, Screen } from '@/ui';

export function RouteErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <ErrorState onRetry={() => void retry()} />
    </Screen>
  );
}
