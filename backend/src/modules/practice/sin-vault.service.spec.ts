import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { base64Bytes, SinVaultService } from './sin-vault.service.js';

const USER = 'd0000000-0000-4000-8000-0000000000f1';
const b64 = (bytes: number) => Buffer.alloc(bytes, 7).toString('base64');
const VAULT = { ciphertext: b64(100), iv: b64(12), salt: b64(16), kdf: 'pbkdf2-sha256', iterations: 210_000, version: 0 };
const STORED = { ...VAULT, version: 2, updatedAt: new Date('2026-10-28T10:00:00.000Z') };

function makePrisma(stored: typeof STORED | null = null, userExists = true) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(userExists ? { sinVault: stored } : null) },
    sinVault: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const service = (prisma: ReturnType<typeof makePrisma>) => new SinVaultService(prisma as unknown as PrismaService);
const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;

describe('SinVaultService', () => {
  it('base64Bytes accepts canonical base64 only', () => {
    expect(base64Bytes(b64(12))).toBe(12);
    expect(base64Bytes('abc')).toBeNull();
    expect(base64Bytes('ab$=')).toBeNull();
    expect(base64Bytes('')).toBeNull();
  });

  it('find: null before the first save, the stored envelope after, 404 for a deleted user', async () => {
    expect(await service(makePrisma()).find(USER)).toEqual({ vault: null });
    expect((await service(makePrisma(STORED)).find(USER)).vault).toMatchObject({ version: 2, updatedAt: '2026-10-28T10:00:00.000Z' });
    await expect(service(makePrisma(null, false)).find(USER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates version 1, then updates only on the matching version', async () => {
    const prisma = makePrisma(STORED);
    expect(await service(prisma).save(USER, VAULT)).toEqual({ version: 1 });
    expect(await service(prisma).save(USER, { ...VAULT, version: 2 })).toEqual({ version: 3 });
    expect(prisma.sinVault.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER, version: 2 } }));
  });

  it('409 SIN_VAULT_CONFLICT with the current vault when the version is stale', async () => {
    const prisma = makePrisma(STORED);
    prisma.sinVault.updateMany.mockResolvedValue({ count: 0 });
    const error = await service(prisma).save(USER, { ...VAULT, version: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'SIN_VAULT_CONFLICT',
      details: { vault: { version: 2, ciphertext: VAULT.ciphertext } },
    });
    prisma.sinVault.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6' }));
    expect(codeOf(await service(prisma).save(USER, VAULT).catch((e: unknown) => e))).toBe('SIN_VAULT_CONFLICT');
  });

  it('checks base64, iv / salt sizes and the ciphertext limit', async () => {
    const s = service(makePrisma());
    expect(codeOf(await s.save(USER, { ...VAULT, ciphertext: 'not base64!' }).catch((e: unknown) => e))).toBe('SIN_VAULT_INVALID');
    expect(codeOf(await s.save(USER, { ...VAULT, iv: b64(16) }).catch((e: unknown) => e))).toBe('SIN_VAULT_INVALID');
    expect(codeOf(await s.save(USER, { ...VAULT, salt: b64(8) }).catch((e: unknown) => e))).toBe('SIN_VAULT_INVALID');
    const big = await s.save(USER, { ...VAULT, ciphertext: b64(128 * 1024 + 1) }).catch((e: unknown) => e);
    expect((big as HttpException).getStatus()).toBe(413);
    expect(codeOf(big)).toBe('SIN_VAULT_TOO_LARGE');
    expect(await s.save(USER, { ...VAULT, ciphertext: b64(128 * 1024) })).toEqual({ version: 1 });
  });

  it('remove deletes the row (idempotent)', async () => {
    const prisma = makePrisma(STORED);
    await service(prisma).remove(USER);
    expect(prisma.sinVault.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
  });
});
