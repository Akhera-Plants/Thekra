/**
 * The shown name of a sin, from the public sins list (the same request for every user; `useSins({ limit: 100 })`).
 * Never the raw slug: an unknown sin reads as «برنامجك». Used inside «تخفَّف» and «لحظة مجاهدة» only, where the screen
 * may name the user's own program; never in a title, a header or a notification.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSins } from '@/lib/api/sins';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';

export const SINS_QUERY = { limit: 100 } as const;

export function useSinName(): { name: (slug: string) => string; isLoading: boolean; list: { slug: string; name: string }[] } {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const sins = useSins(SINS_QUERY);
  const name = useCallback(
    (slug: string) => {
      const s = sins.data?.find((x) => x.slug === slug);
      if (!s) return t('sinProgram.unnamed');
      return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
    },
    [sins.data, locale, t],
  );
  const list = (sins.data ?? []).map((x) => ({ slug: x.slug, name: name(x.slug) }));
  return { name, isLoading: sins.isLoading, list };
}
