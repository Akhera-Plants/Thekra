import { RouteSkeleton } from '@/components/shared/feedback/RouteSkeleton';

export default function Loading() {
  return <RouteSkeleton variant="plain" crumbs={false} />;
}
