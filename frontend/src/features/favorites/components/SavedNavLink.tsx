'use client';

import { Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { formatDigits } from '@/lib/format/digits';
import { useFavoriteQuoteIds } from '@/features/favorites/hooks/useFavoriteQuoteIds';
import { useSession } from '@/features/auth/hooks/useSession';

/** Favorites nav item with live count — lives in features (shared chrome must not fetch). */
export function SavedNavLink() {
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const { isAuthenticated } = useSession();
  const { ids } = useFavoriteQuoteIds();
  const current = pathname === '/favorites' || pathname.startsWith('/favorites/');
  const count = isAuthenticated && ids.size > 0 ? ids.size : 0;

  return (
    <Link
      href="/favorites"
      className="nav-link saved-nav"
      aria-current={current ? 'page' : undefined}
    >
      <Bookmark className="size-[17px]" aria-hidden />
      <span>{tNav('favorites')}</span>
      {count > 0 ? <span className="saved-count">{formatDigits(count)}</span> : null}
    </Link>
  );
}
