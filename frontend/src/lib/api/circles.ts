/**
 * «صحبة» lives in the app only (practice-core nav-map); the website reads just one thing about it: whether the member is
 * in a circle, so «شارك تطورك مع الصحبة» shows on the same habits as in the app (owner round 6, C-02b).
 */
import { apiGet } from '@/lib/api-client';

/** Not language-dependent: no `?lang=`. */
const NO_LANG = { skipLang: true } as Record<string, unknown>;

/** GET /circles/access: the website uses `enabled` and `inCircle` only (the invite numbers are the app's). */
export interface CircleAccess {
  enabled: boolean;
  inCircle: boolean;
}

export async function getCircleAccess(): Promise<CircleAccess> {
  const data = (await apiGet<Partial<CircleAccess>>('/circles/access', NO_LANG)).data;
  return { enabled: data.enabled === true, inCircle: data.inCircle === true };
}
