/**
 * Owner round 3, item 20 (build-16 bugs): «المحفوظات» reads the API's `{ id, createdAt, quote }` rows (and the bare
 * quotes an older build cached), the ids come from `/favorites/quote-ids`, and query arrays go out as repeated keys
 * (`type=A&type=B`), which the API's `TransformToArray` accepts, never `type[]=`.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'http://localhost:3001' } } },
}));

import axios from 'axios';
import { PARAMS_SERIALIZER, apiClient } from '../lib/api-client';
import { favoriteQuotes, fetchFavoriteIds } from '../lib/api/favorites';
import type { QuoteDto } from '../lib/types/api';

const quote = { id: 'q1', textAr: 'نص', type: 'HADITH' } as unknown as QuoteDto;

describe('favorites (item 20)', () => {
  it('reads the favorite rows as quotes, and older cached bare quotes too', () => {
    expect(favoriteQuotes([{ id: 'f1', createdAt: '2026-11-01T00:00:00Z', quote }]).map((q) => q.id)).toEqual(['q1']);
    expect(favoriteQuotes([quote]).map((q) => q.id)).toEqual(['q1']);
    expect(favoriteQuotes([{ id: 'f2', createdAt: 'x' }, null, 3])).toEqual([]);
    expect(favoriteQuotes(undefined)).toEqual([]);
    expect(favoriteQuotes([quote])[0]!.isFavorite).toBe(true);
  });

  it('asks the API route that exists', async () => {
    const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: ['q1'] } });
    await fetchFavoriteIds();
    expect(get).toHaveBeenCalledWith('/favorites/quote-ids', undefined);
    get.mockRestore();
  });
});

describe('query arrays (item 20)', () => {
  it('sends repeated keys, never brackets', () => {
    const uri = axios.getUri({ url: '/quotes', params: { type: ['HADITH', 'QURAN_VERSE'], tag: ['sabr'] }, paramsSerializer: PARAMS_SERIALIZER });
    expect(uri).toContain('type=HADITH&type=QURAN_VERSE');
    expect(uri).toContain('tag=sabr');
    expect(uri).not.toContain('%5B%5D');
    expect(uri).not.toContain('[]');
    expect(apiClient.defaults.paramsSerializer).toEqual(PARAMS_SERIALIZER);
  });
});
