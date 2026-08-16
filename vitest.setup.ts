import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
import { resetPersistenceForTesting } from './src/lib/storage/database';
import { flushAppStateWrites } from './src/lib/storage/appState';

beforeEach(async () => {
  await flushAppStateWrites();
  await resetPersistenceForTesting();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.includes('/api/calendar/')
        ? { calendars: [] }
        : { connected: false, accountEmail: null };
      return {
        ok: true,
        status: 200,
        json: async () => body
      } as unknown as Response;
    })
  );
});
