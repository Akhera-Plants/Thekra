import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { getCircleAccess } from '@/lib/api/circles';
import { queryKeys } from '@/lib/query-keys';

/**
 * True when the signed-in member is in a «صحبة» circle (GET /circles/access), so «شارك تطورك مع الصحبة» shows as in the
 * app. False for a visitor, while loading, and on any error (the line is a suggestion, never needed).
 */
export function useInCircle(): boolean {
  const { user, isAuthenticated } = useSession();
  const userId = isAuthenticated && user ? user.id : null;
  const access = useQuery({
    queryKey: queryKeys.practice.circleAccess(userId ?? ''),
    queryFn: getCircleAccess,
    enabled: userId !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return userId !== null && access.data?.inCircle === true;
}
