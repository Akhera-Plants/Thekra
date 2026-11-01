import { describe, expect, it } from 'vitest';
import { currentMemberItem, isInMore, MEMBER_MORE, MEMBER_PRIMARY } from './member-nav';

describe('member navigation', () => {
  it('marks the page that owns the path', () => {
    expect(currentMemberItem('/practice')).toBe('wird');
    expect(currentMemberItem('/practice/habits')).toBe('habits');
    expect(currentMemberItem('/practice/leave-sin')).toBe('habits');
    expect(currentMemberItem('/practice/leave-sin/moment')).toBe('habits');
    expect(currentMemberItem('/favorites')).toBe('favorites');
    expect(currentMemberItem('/calendar')).toBe('calendar');
  });

  it('gives practice pages without an item to «ورد اليوم», and nothing to public pages', () => {
    expect(currentMemberItem('/practice/kinship')).toBe('wird');
    expect(currentMemberItem('/practice/notifications')).toBe('wird');
    expect(currentMemberItem('/sins')).toBeNull();
    expect(currentMemberItem('/practice-x')).toBeNull();
  });

  it('marks «المزيد» only for its own items', () => {
    expect(isInMore('reviews')).toBe(true);
    expect(isInMore('habits')).toBe(false);
    expect(isInMore(null)).toBe(false);
  });

  it('lists every place once', () => {
    const keys = [...MEMBER_PRIMARY, ...MEMBER_MORE.flatMap((g) => g.items)].map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('record');
    // «تخفَّف» is the «تخفَّف من معصية» door and lives in «عاداتي»: no second entry (owner, 2026-11-01).
    expect(keys).not.toContain('leaveSin');
    expect([...MEMBER_PRIMARY, ...MEMBER_MORE.flatMap((g) => g.items)].map((i) => i.href)).not.toContain('/practice/leave-sin');
  });
});
