import { of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();

  it('wraps a plain value in { data }', async () => {
    const result = await new Promise((resolve) => {
      interceptor
        .intercept({} as never, { handle: () => of({ id: '1' }) })
        .subscribe(resolve);
    });
    expect(result).toEqual({ data: { id: '1' } });
  });

  it('passes through an already-enveloped { data, meta } payload', async () => {
    const payload = { data: [1], meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false } };
    const result = await new Promise((resolve) => {
      interceptor
        .intercept({} as never, { handle: () => of(payload) })
        .subscribe(resolve);
    });
    expect(result).toBe(payload);
  });
});
