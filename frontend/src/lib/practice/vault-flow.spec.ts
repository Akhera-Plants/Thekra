import { describe, expect, it } from 'vitest';
import { checkIn, endProgram, startProgram, VaultLockedError, type SinProgram, type VaultPayload } from '@thekra/practice-core';
import { ApiError } from '@/lib/types/api';
import { safeNextPath } from '@/features/auth/next-path';
import {
  VaultExistsError,
  createVault,
  mergePrograms,
  openVault,
  saveVault,
  type ServerVaultLike,
  type VaultApi,
} from './vault-flow';

/** The contract's vault endpoints in memory: optimistic `version`, 409 on a stale one. */
function fakeVaultServer() {
  let stored: ServerVaultLike | null = null;
  const bodies: VaultPayload[] = [];
  const api: VaultApi = {
    get: async () => (stored ? { ...stored } : null),
    put: async (body) => {
      bodies.push(body);
      const current = stored?.version ?? 0;
      if (body.version !== current)
        throw new ApiError({ code: 'SIN_VAULT_CONFLICT', message: 'conflict', status: 409, kind: 'http' });
      stored = { ...body, version: current + 1 };
      return current + 1;
    },
    remove: async () => {
      stored = null;
    },
  };
  return { api, bodies, current: () => stored };
}

const ghibah = (): SinProgram =>
  startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' });

describe('sin vault flows', () => {
  it('seals on one device, opens on another with the code, and never sends the slug or notes in clear', async () => {
    const server = fakeVaultServer();
    const programs = [checkIn(ghibah(), '2026-10-27', 'held', 'ملاحظة خاصة')];
    const session = await createVault(server.api, programs, 'رمز-سري-1');
    expect(session.version).toBe(1);
    const sent = JSON.stringify(server.bodies);
    expect(sent).not.toContain('ghibah');
    expect(sent).not.toContain('ملاحظة');
    expect(server.bodies[0]).toMatchObject({ kdf: 'pbkdf2-sha256', iterations: 600000, version: 0 });

    const opened = await openVault(server.api, 'رمز-سري-1');
    expect(opened?.programs).toEqual(programs);
    await expect(openVault(server.api, 'رمز-خطأ')).rejects.toBeInstanceOf(VaultLockedError);
    await expect(createVault(server.api, programs, 'رمز-آخر-123')).rejects.toBeInstanceOf(VaultExistsError);
  }, 30_000);

  it('on 409 re-opens the newer vault with the session key, merges, and saves on top of it', async () => {
    const server = fakeVaultServer();
    const start = [ghibah()];
    const a = await createVault(server.api, start, 'code-123456');
    const b = await openVault(server.api, 'code-123456');
    if (!b) throw new Error('vault missing');

    // B saves first (a check-in on the 27th); A, still on version 1, saves its own check-in on the 28th.
    const bSaved = await saveVault(server.api, b.session, [checkIn(ghibah(), '2026-10-27', 'weak')]);
    expect(bSaved.session.version).toBe(2);
    const aSaved = await saveVault(server.api, a, [checkIn(ghibah(), '2026-10-28', 'held')]);
    expect(aSaved.session.version).toBe(3);
    expect(aSaved.programs[0]?.checkIns.map((c) => [c.date, c.value])).toEqual([
      ['2026-10-27', 'weak'],
      ['2026-10-28', 'held'],
    ]);
    const final = await openVault(server.api, 'code-123456');
    expect(final?.programs).toEqual(aSaved.programs);
  }, 30_000);

  it('asks to open again when the vault was re-made with another code elsewhere', async () => {
    const server = fakeVaultServer();
    const a = await createVault(server.api, [ghibah()], 'first-code');
    await server.api.remove();
    await createVault(server.api, [ghibah()], 'second-code');
    await expect(saveVault(server.api, { ...a, version: 0 }, [ghibah()])).rejects.toBeInstanceOf(VaultLockedError);
  }, 30_000);
});

describe('mergePrograms', () => {
  it('unites check-ins by date; on the same date the later check-in wins with its note (not the copy with more)', () => {
    const t = (h: number) => `2026-10-26T1${h}:00:00.000Z`;
    let local = checkIn(ghibah(), '2026-10-25', 'held', undefined, t(1));
    local = checkIn(local, '2026-10-26', 'weak', 'device', t(2));
    const remote = checkIn(ghibah(), '2026-10-26', 'held', 'vault, edited later', t(3));
    const merged = mergePrograms(
      [local],
      [remote, startProgram({ sinSlug: 'ghadab', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' })],
    );
    expect(merged.map((p) => p.sinSlug)).toEqual(['ghibah', 'ghadab']);
    expect(merged[0]?.checkIns).toEqual([
      { date: '2026-10-25', value: 'held', updatedAt: t(1) },
      { date: '2026-10-26', value: 'held', note: 'vault, edited later', updatedAt: t(3) },
    ]);
  });

  it('a program ended on this device is not brought back by the older copy in the vault', () => {
    const started = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, '2026-10-20T10:00:00.000Z');
    const vaultCopy = checkIn(started, '2026-10-25', 'held', 'old note', '2026-10-25T10:00:00.000Z');
    const ended = endProgram(vaultCopy, '2026-10-26T10:00:00.000Z');
    const merged = mergePrograms([ended], [vaultCopy]);
    expect(merged).toEqual([ended]);
    expect(JSON.stringify(merged)).not.toContain('old note');
  });
});

describe('safeNextPath', () => {
  it('keeps site paths and refuses anything that could leave the site', () => {
    expect(safeNextPath('/practice/leave-sin')).toBe('/practice/leave-sin');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath(null, '/practice')).toBe('/practice');
  });
});
