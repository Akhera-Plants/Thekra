import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { NameOfAllahDetailDto, NameOfAllahDto } from '../types/api';
import type { LocaleCode } from '../types/enums';

/** «الأسماء الحسنى» (redesign §4.7): GET /v1/names-of-allah and /v1/names-of-allah/:slug. */
export async function fetchNamesOfAllah() {
  return apiGet<NameOfAllahDto[]>('/names-of-allah');
}

export async function fetchNameOfAllah(slug: string, lang: LocaleCode) {
  return apiGet<NameOfAllahDetailDto>(`/names-of-allah/${encodeURIComponent(slug)}`, { params: { lang } });
}

/** The names in the API order (names-of-allah.yaml). */
export function useNamesOfAllah() {
  return useQuery({
    queryKey: queryKeys.namesOfAllah.list,
    queryFn: fetchNamesOfAllah,
    select: (r) => r.data,
  });
}

export function useNameOfAllah(slug: string) {
  const { i18n } = useTranslation();
  const lang: LocaleCode = i18n.language === 'en' ? 'en' : 'ar';
  return useQuery({
    queryKey: queryKeys.namesOfAllah.detail(slug, lang),
    queryFn: () => fetchNameOfAllah(slug, lang),
    enabled: slug.length > 0,
    select: (r) => r.data,
  });
}

/** App route of a name link: a good deed, a sin, or an action (leave-sin → the «تخفَّف» program). */
export function nameLinkRoute(link: { kind: 'deed' | 'sin' | 'action'; slug: string }): string {
  if (link.kind === 'deed') return `/good-deeds/${link.slug}`;
  if (link.kind === 'sin') return `/sins/${link.slug}`;
  return '/practice/sin-program';
}
