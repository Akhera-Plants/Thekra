/**
 * «في لحظات مثل هذه» (owner round 6, C-09): the list is ours, the same for every user, edited on the API's desk and
 * served by `GET /v1/home-moments?lang=` (CDN-cached). The member never chooses it. Each moment opens its topic page
 * (`topic.path`: /sins/<slug>, /good-deeds/<slug> or /branches/<n>, the app's own routes).
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api-client';
import { isTopicPath } from '../home/moments';

export interface HomeMomentDto {
  key: string;
  /** Phrased as help: «تعينك على التخفّف من الغضب». */
  label: string;
  /** The moment itself («قبل أن تردّ وأنت غاضب»), when written. */
  situation: string | null;
  /** A kebab-case icon key (pause, sun, message-circle, heart, …). */
  icon: string;
  topic: { type: 'sin' | 'good-deed' | 'branch'; slug: string; title: string; path: string };
}

export async function fetchHomeMoments(lang: 'ar' | 'en'): Promise<HomeMomentDto[]> {
  return (await apiGet<HomeMomentDto[]>('/home-moments', { params: { lang } })).data;
}


export function useHomeMoments() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  return useQuery({
    queryKey: ['home-moments', lang],
    queryFn: () => fetchHomeMoments(lang),
    staleTime: 60 * 60 * 1000,
    select: (list) => list.filter((m) => isTopicPath(m.topic.path)),
  });
}
