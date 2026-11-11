/**
 * Runs the real public/sw.js in a sandbox with a fake worker scope, then drives its push and notificationclick
 * handlers. The caching handlers are not exercised here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://thekra-web.vercel.app';
const SOURCE = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

interface FakeClient {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

function fakeClient(url: string, controlled = true): FakeClient {
  const client: FakeClient = { url, focus: vi.fn(), navigate: vi.fn() };
  client.focus.mockResolvedValue(client);
  client.navigate.mockImplementation(async (target: string) => {
    if (!controlled) throw new TypeError('not controlled');
    client.url = target;
    return client;
  });
  return client;
}

function loadWorker(windows: FakeClient[] = []) {
  const handlers = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(null);
  const scope = {
    location: new URL(`${ORIGIN}/sw.js?api=https%3A%2F%2Fthekra.vercel.app`),
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue(windows), openWindow, claim: vi.fn() },
  };
  runInNewContext(SOURCE, { self: scope, URL, caches: {}, fetch: vi.fn() });

  async function dispatch(type: string, event: Record<string, unknown>): Promise<void> {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.get(type)?.({ ...event, waitUntil: (promise: Promise<unknown>) => (pending = promise) });
    await pending;
  }

  return {
    showNotification,
    openWindow,
    push: (data: { json: () => unknown } | null) => dispatch('push', { data }),
    click: (data: unknown) => {
      const close = vi.fn();
      return dispatch('notificationclick', { notification: { data, close } }).then(() => close);
    },
  };
}

const json = (value: unknown) => ({ json: () => value });

describe('sw.js push', () => {
  it('shows the payload in Arabic, right to left, for an Arabic link', async () => {
    const worker = loadWorker();
    await worker.push(json({ title: 'قراءة القرآن', body: 'المطلوب اليوم: صفحتان', url: '/practice', tag: 'habit-1' }));
    expect(worker.showNotification).toHaveBeenCalledWith('قراءة القرآن', {
      body: 'المطلوب اليوم: صفحتان',
      icon: '/icons/icon-192.png',
      lang: 'ar',
      dir: 'rtl',
      tag: 'habit-1',
      data: { url: '/practice' },
    });
  });

  it('uses left to right for an English link', async () => {
    const worker = loadWorker();
    await worker.push(json({ title: 'Kinship', body: 'Today: 2', url: '/en/practice/kinship', tag: 'kinship' }));
    expect(worker.showNotification).toHaveBeenCalledWith(
      'Kinship',
      expect.objectContaining({ lang: 'en', dir: 'ltr', data: { url: '/en/practice/kinship' } }),
    );
  });

  it('still shows a notification for an empty or broken payload', async () => {
    const worker = loadWorker();
    await worker.push(null);
    await worker.push({ json: () => JSON.parse('{oops') });
    expect(worker.showNotification).toHaveBeenNthCalledWith(1, 'ذكرى', expect.objectContaining({ body: '', data: { url: '/' } }));
    expect(worker.showNotification).toHaveBeenNthCalledWith(2, 'ذكرى', expect.objectContaining({ dir: 'rtl' }));
    expect(worker.showNotification.mock.calls[0][1]).not.toHaveProperty('tag');
  });

  it('never keeps a link to another origin', async () => {
    const worker = loadWorker();
    for (const url of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)', 42]) {
      await worker.push(json({ title: 't', body: 'b', url }));
    }
    for (const call of worker.showNotification.mock.calls) expect(call[1].data).toEqual({ url: '/' });
  });
});

describe('sw.js notificationclick', () => {
  it('focuses a tab already on the link', async () => {
    const tab = fakeClient(`${ORIGIN}/practice`);
    const worker = loadWorker([tab]);
    const close = await worker.click({ url: '/practice' });
    expect(close).toHaveBeenCalled();
    expect(tab.focus).toHaveBeenCalled();
    expect(tab.navigate).not.toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it('moves another tab of the site to the link, skipping tabs of other sites', async () => {
    const other = fakeClient('https://elsewhere.example/');
    const tab = fakeClient(`${ORIGIN}/sins`);
    const worker = loadWorker([other, tab]);
    await worker.click({ url: '/en/practice/kinship' });
    expect(other.navigate).not.toHaveBeenCalled();
    expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/en/practice/kinship`);
    expect(tab.focus).toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it('opens a window when no tab can be used, and only on this site', async () => {
    const uncontrolled = fakeClient(`${ORIGIN}/sins`, false);
    const worker = loadWorker([uncontrolled]);
    await worker.click({ url: 'https://evil.example/' });
    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);

    const empty = loadWorker([]);
    await empty.click(null);
    expect(empty.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});
