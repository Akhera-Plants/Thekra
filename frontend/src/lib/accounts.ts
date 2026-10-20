/**
 * Public account chrome (sign-in, register, favorites, save) is gated until the
 * next product phase. Admin still uses the same session API via /admin.
 */
export function accountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true';
}
