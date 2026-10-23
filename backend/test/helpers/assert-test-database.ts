/**
 * E2E tests empty and reseed the database they run on. They once ran on the
 * development database because DATABASE_URL was already exported in the shell
 * (the env file never overrides it), and wiped it. Refuse any database whose
 * name does not end in `_test`.
 */
export function assertTestDatabase(databaseUrl: string | undefined): void {
  let name = '';
  try {
    name = decodeURIComponent(new URL(databaseUrl ?? '').pathname.replace(/^\//, ''));
  } catch {
    // An unparsable URL fails below with the same message.
  }
  if (!/_test$/.test(name)) {
    throw new Error(
      `[e2e] Refusing to run: DATABASE_URL points at database "${name || '(none)'}". ` +
        'E2E tests delete data, so the database name must end in "_test" (see .env.test.example).',
    );
  }
}
