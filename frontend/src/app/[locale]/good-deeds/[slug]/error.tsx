'use client';

import { RouteError } from '@/components/shared/feedback/RouteError';

export default function RouteSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteError error={error} retry={retry} />;
}
