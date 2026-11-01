/**
 * The signed-in member's places in the header (owner, 2026-11-01): «ورد اليوم» · «عاداتي» in the bar, and «المزيد»
 * (a menu on desktop, the side drawer on phones) with the rest in three short groups. One list, so the two menus never
 * drift apart.
 */
export type MemberNavKey =
  | 'wird'
  | 'habits'
  | 'periodic'
  | 'reviews'
  | 'leaveSin'
  | 'strategies'
  | 'favorites'
  | 'calendar';

export interface MemberNavItem {
  key: MemberNavKey;
  href: string;
}

export interface MemberNavGroup {
  key: 'track' | 'help' | 'reading';
  items: readonly MemberNavItem[];
}

export const MEMBER_PRIMARY: readonly MemberNavItem[] = [
  { key: 'wird', href: '/practice' },
  { key: 'habits', href: '/practice/habits' },
];

export const MEMBER_MORE: readonly MemberNavGroup[] = [
  {
    key: 'track',
    items: [
      { key: 'periodic', href: '/practice/periodic' },
      { key: 'reviews', href: '/practice/reviews' },
    ],
  },
  {
    key: 'help',
    items: [
      { key: 'leaveSin', href: '/practice/leave-sin' },
      { key: 'strategies', href: '/practice/strategies' },
    ],
  },
  {
    key: 'reading',
    items: [
      { key: 'favorites', href: '/favorites' },
      { key: 'calendar', href: '/calendar' },
    ],
  },
];

/**
 * The item that marks the current page, or null. A page under an item counts (`/practice/leave-sin/moment` is
 * «تخفَّف»); «ورد اليوم» owns `/practice` and the practice pages that have no item of their own (kinship, notifications…).
 */
export function currentMemberItem(pathname: string): MemberNavKey | null {
  const all = [...MEMBER_PRIMARY, ...MEMBER_MORE.flatMap((group) => group.items)].filter((item) => item.key !== 'wird');
  const hit = all.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  if (hit) return hit.key;
  return pathname === '/practice' || pathname.startsWith('/practice/') ? 'wird' : null;
}

/** True when the current page is one of the «المزيد» items (the trigger is then marked too). */
export function isInMore(current: MemberNavKey | null): boolean {
  return current !== null && MEMBER_MORE.some((group) => group.items.some((item) => item.key === current));
}
