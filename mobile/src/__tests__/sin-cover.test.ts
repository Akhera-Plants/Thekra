import { hasSinData, shouldCover } from '../lib/practice/sin-cover';

describe('app-switcher cover (owner round 8)', () => {
  it('covers every screen when the app leaves the foreground and a program exists', () => {
    expect(shouldCover(false, 1, 'none')).toBe(true); // a program on the device, no vault
    expect(shouldCover(false, 0, 'locked')).toBe(true); // a vault that holds one, still locked
    expect(shouldCover(false, 0, 'unlocked')).toBe(true);
    expect(shouldCover(false, 2, 'unknown')).toBe(true);
  });

  it('never covers in the foreground', () => {
    expect(shouldCover(true, 3, 'unlocked')).toBe(false);
  });

  it('covers nothing when there is no program to protect', () => {
    expect(shouldCover(false, 0, 'none')).toBe(false);
    expect(shouldCover(false, 0, 'unknown')).toBe(false);
    expect(shouldCover(false, 0, 'offline')).toBe(false);
    expect(hasSinData(0, 'none')).toBe(false);
  });
});
