import {
  BookOpenText,
  Flag,
  HandHeart,
  Inbox,
  Library,
  Link2,
  RefreshCcw,
  Scale,
  Tags,
} from 'lucide-react';

export type AdminNavKey =
  | 'overview'
  | 'flags'
  | 'proposals'
  | 'quotes'
  | 'sins'
  | 'goodDeeds'
  | 'sources'
  | 'tags'
  | 'sync';

export interface AdminNavItem {
  key: AdminNavKey;
  href: string;
  icon: React.ElementType;
}

export interface AdminNavGroup {
  key: 'groupReview' | 'groupContent' | 'groupSystem';
  items: AdminNavItem[];
}

/** The desk's map. Order = the owner's priority: flags → proposals → texts → system. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: 'groupReview',
    items: [
      { key: 'overview', href: '/admin', icon: Inbox },
      { key: 'flags', href: '/admin/flags', icon: Flag },
      { key: 'proposals', href: '/admin/linking', icon: Link2 },
    ],
  },
  {
    key: 'groupContent',
    items: [
      { key: 'quotes', href: '/admin/quotes', icon: BookOpenText },
      { key: 'sins', href: '/admin/sins', icon: Scale },
      { key: 'goodDeeds', href: '/admin/good-deeds', icon: HandHeart },
      { key: 'sources', href: '/admin/sources', icon: Library },
      { key: 'tags', href: '/admin/tags', icon: Tags },
    ],
  },
  {
    key: 'groupSystem',
    items: [{ key: 'sync', href: '/admin/sync', icon: RefreshCcw }],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

export function isActiveHref(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}
