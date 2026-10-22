import type { UserDto } from '@/lib/api/auth';

/** Map backend safe user (`displayName`) to frontend `UserDto` (`name`). */
export function mapAuthUser(raw: unknown): UserDto | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  if (typeof u.id !== 'string' || typeof u.email !== 'string') return undefined;
  if (u.role !== 'USER' && u.role !== 'ADMIN') return undefined;

  let name: string | null = null;
  if (typeof u.displayName === 'string') name = u.displayName;
  else if (u.displayName === null) name = null;
  else if (typeof u.name === 'string') name = u.name;
  else if (u.name === null) name = null;

  return {
    id: u.id,
    email: u.email,
    name,
    role: u.role,
    createdAt: typeof u.createdAt === 'string' ? u.createdAt : '',
    updatedAt: typeof u.updatedAt === 'string' ? u.updatedAt : '',
  };
}
