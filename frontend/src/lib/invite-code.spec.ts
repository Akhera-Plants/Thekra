import { describe, expect, it } from 'vitest';
import { formatInviteCode, inviteAppLink, readInviteCode } from './invite-code';

describe('invite code from a link', () => {
  it('accepts a typed or shared form and returns the plain upper-case code', () => {
    expect(readInviteCode('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(readInviteCode('ABCDEFGHJK')).toBe('ABCDEFGHJK');
  });

  it('refuses anything that is not an invite code (no echo of the input)', () => {
    for (const raw of ['', 'abc', '<script>alert(1)</script>', 'ABCDE FGHJK', '%E0%A4%A', 'A'.repeat(25)]) {
      expect(readInviteCode(raw)).toBeNull();
    }
  });

  it('groups ten characters in two fives and links to the app', () => {
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(inviteAppLink('ABCDEFGHJK')).toBe('thekra://circles/invite/ABCDEFGHJK');
  });
});
