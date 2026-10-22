/**
 * performRefresh — body-based mobile refresh flow.
 * Mirrors backend POST /v1/auth/refresh { refreshToken } (cookie is web-only).
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

jest.mock('axios', () => {
  const actual = jest.requireActual('axios') as typeof import('axios');
  return {
    __esModule: true,
    default: {
      ...actual,
      post: jest.fn(),
      create: jest.fn(() => ({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        request: jest.fn(),
      })),
      isAxiosError: actual.isAxiosError,
    },
  };
});

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  clearRefreshToken,
  getAccessToken,
  performRefresh,
  saveRefreshToken,
  SECURE_STORE_REFRESH_KEY,
  setAccessToken,
} from '../lib/api-client';

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockedGetItem = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockedSetItem = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

describe('performRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAccessToken(null);
    mockedGetItem.mockResolvedValue('stored-refresh');
    mockedSetItem.mockResolvedValue();
    mockedDeleteItem.mockResolvedValue();
  });

  it('sends the stored refresh token in the request body and saves the new pair', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 900,
        },
      },
    });

    const token = await performRefresh();

    expect(token).toBe('new-access');
    expect(getAccessToken()).toBe('new-access');
    expect(mockedPost).toHaveBeenCalledWith(
      'http://localhost:3001/v1/auth/refresh',
      { refreshToken: 'stored-refresh' },
      { timeout: 10_000 },
    );
    expect(mockedSetItem).toHaveBeenCalledWith(
      SECURE_STORE_REFRESH_KEY,
      'new-refresh',
    );
  });

  it('clears tokens when the refresh request fails', async () => {
    setAccessToken('stale-access');
    mockedPost.mockRejectedValueOnce(new Error('network'));

    const token = await performRefresh();

    expect(token).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(mockedDeleteItem).toHaveBeenCalledWith(SECURE_STORE_REFRESH_KEY);
  });

  it('returns null without calling the API when no refresh token is stored', async () => {
    mockedGetItem.mockResolvedValueOnce(null);

    const token = await performRefresh();

    expect(token).toBeNull();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('shares one in-flight request across concurrent callers', async () => {
    mockedPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                data: {
                  accessToken: 'shared-access',
                  refreshToken: 'shared-refresh',
                },
              },
            });
          }, 20);
        }) as ReturnType<typeof axios.post>,
    );

    const results = await Promise.all([performRefresh(), performRefresh()]);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['shared-access', 'shared-access']);
  });
});

describe('secure refresh helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSetItem.mockResolvedValue();
    mockedDeleteItem.mockResolvedValue();
  });

  it('saveRefreshToken writes the SecureStore key', async () => {
    await saveRefreshToken('abc');
    expect(mockedSetItem).toHaveBeenCalledWith(SECURE_STORE_REFRESH_KEY, 'abc');
  });

  it('clearRefreshToken deletes the SecureStore key', async () => {
    await clearRefreshToken();
    expect(mockedDeleteItem).toHaveBeenCalledWith(SECURE_STORE_REFRESH_KEY);
  });
});
