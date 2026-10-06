const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Server-side: load current user after token refresh (refresh body has no user). */
export async function fetchAuthMeFromBackend(
  accessToken: string,
): Promise<unknown | undefined> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return undefined;
  }
  if (!res.ok) return undefined;
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}
