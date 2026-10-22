/**
 * Creates the ADMIN user, or resets its password and role, from ADMIN_EMAIL and
 * ADMIN_PASSWORD against whatever DATABASE_URL is set. Hashes with the same
 * argon2 settings as AuthService (src/modules/auth/password-hash.ts).
 * Run through scripts/admin/run.ts (`pnpm --filter backend admin:create`).
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../../src/modules/auth/password-hash.js';
import { AdminInputError, describeTarget, parseAdminInput } from './input.js';

export async function main(env: Readonly<Record<string, string | undefined>>): Promise<number> {
  let input;
  try {
    input = parseAdminInput(env);
  } catch (error) {
    if (!(error instanceof AdminInputError)) throw error;
    for (const problem of error.problems) console.error(`admin:create: ${problem}`);
    return 2;
  }

  const target = describeTarget(input.databaseUrl);
  const prisma = new PrismaClient({ datasourceUrl: input.databaseUrl });
  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.upsert({
      where: { email: input.email },
      create: { email: input.email, passwordHash, role: UserRole.ADMIN },
      update: { passwordHash, role: UserRole.ADMIN },
      select: { id: true, email: true, role: true },
    });
    console.log(`admin:create: ${existing ? 'reset' : 'created'} ${user.role} ${user.email} (id ${user.id}) on ${target}`);
    return 0;
  } catch (error) {
    console.error(`admin:create: failed on ${target}:`, error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}
