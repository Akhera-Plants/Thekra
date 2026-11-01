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
    items: [{ key: 'strategies', href: '/practice/strategies' }],
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
 * «تخفَّف» has no item of its own (owner, 2026-11-01: it is the «تخفَّف من معصية» door, and its programs are listed in
 * «عاداتي»), so its pages mark «عاداتي».
 */
const LEAVE_SIN_HREF = '/practice/leave-sin';

/**
 * The item that marks the current page, or null. A page under an item counts (`/practice/habits/…` is «عاداتي»);
 * «تخفَّف» pages count as «عاداتي»; «ورد اليوم» owns `/practice` and the practice pages that have no item of their own
 * (kinship, notifications…).
 */
export function currentMemberItem(pathname: string): MemberNavKey | null {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (under(LEAVE_SIN_HREF)) return 'habits';
  const all = [...MEMBER_PRIMARY, ...MEMBER_MORE.flatMap((group) => group.items)].filter((item) => item.key !== 'wird');
  const hit = all.find((item) => under(item.href));
  if (hit) return hit.key;
  return pathname === '/practice' || pathname.startsWith('/practice/') ? 'wird' : null;
}

/** True when the current page is one of the «المزيد» items (the trigger is then marked too). */
export function isInMore(current: MemberNavKey | null): boolean {
  return current !== null && MEMBER_MORE.some((group) => group.items.some((item) => item.key === current));
}
