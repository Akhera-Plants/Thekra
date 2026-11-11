import { describe, expect, it } from 'vitest';
import { failureKey, isRetryable } from '@/lib/errors';
import { ApiError } from '@/lib/types/api';

const make = (status: number, kind?: ApiError['kind']) =>
  new ApiError({ code: 'X', message: 'raw', status, kind });

describe('failureKey', () => {
  it('maps transport failures', () => {
    expect(failureKey(make(0, 'network'))).toBe('network');
    expect(failureKey(make(0))).toBe('network');
    expect(failureKey(make(0, 'timeout'))).toBe('timeout');
  });

  it('maps HTTP statuses', () => {
    expect(failureKey(make(404))).toBe('notFound');
    expect(failureKey(make(401))).toBe('unauthorized');
    expect(failureKey(make(429))).toBe('rateLimited');
    expect(failureKey(make(503))).toBe('server');
    expect(failureKey(make(422, 'validation'))).toBe('validation');
    expect(failureKey(make(200, 'parse'))).toBe('server');
  });

  it('treats anything else as unknown', () => {
    expect(failureKey(new Error('boom'))).toBe('unknown');
    expect(failureKey(make(418))).toBe('unknown');
  });

  it('does not offer a retry for failures that repeat', () => {
    expect(isRetryable(make(404))).toBe(false);
    expect(isRetryable(make(422, 'validation'))).toBe(false);
    expect(isRetryable(make(0, 'network'))).toBe(true);
    expect(isRetryable(make(500))).toBe(true);
  });
});
