'use client';

import { useLinkStatus } from 'next/link';
import { useTranslations } from 'next-intl';
import { BrandLoader } from './BrandLoader';

/**
 * Put inside a `<Link>`: shows the inline loader while that link's navigation is
 * pending (`useLinkStatus`). Fixed size and always rendered, so showing it never
 * shifts the layout; it fades in after a short delay so fast navigations stay quiet.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  const t = useTranslations('feedback');
  return (
    <span className="link-pending" data-pending={pending} aria-hidden={!pending}>
      {pending ? <BrandLoader label={t('navigating')} /> : null}
    </span>
  );
}
