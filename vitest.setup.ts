import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { resetPersistenceForTesting } from './src/lib/storage/database';
import { flushAppStateWrites } from './src/lib/storage/appState';

beforeEach(async () => {
  await flushAppStateWrites();
  await resetPersistenceForTesting();
});
