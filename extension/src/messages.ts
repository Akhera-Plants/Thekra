/** Popup → background messages. Every account and sync call runs in the background, one at a time. */
export type Message =
  | { type: 'ready' }
  | { type: 'sync' }
  | { type: 'signIn'; email: string; password: string }
  | { type: 'signOut' };

export type Reply = { ok: true } | { ok: false; error: string };

export function isMessage(v: unknown): v is Message {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (m.type === 'ready' || m.type === 'sync' || m.type === 'signOut') return true;
  return m.type === 'signIn' && typeof m.email === 'string' && typeof m.password === 'string';
}
