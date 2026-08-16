/**
 * React integration for the AstroAlign persistence layer.
 *
 * `AppStateProvider` loads all persistent data once at startup, exposes the
 * loaded data for hydration and provides a small reactive "app state" cache
 * (key/value records written to the `appState` store). UI components use the
 * `usePersistedState` hook to get a React state value that is automatically
 * persisted (debounced) to IndexedDB.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { getBackendKind, reportPersistenceError, subscribeToPersistenceErrors } from './database';
import { clearAppStateStore, loadAllData, saveAppStateRecord, type HydratedData } from './repository';

export type PersistenceStatus = 'loading' | 'ready' | 'degraded' | 'error';

export interface AppStateContextValue {
  isHydrated: boolean;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  /** The full set of data loaded from the database (null until hydration). */
  hydratedData: HydratedData | null;
  getAppState(_key: string): unknown;
  setAppState(_key: string, _value: unknown): void;
  clearPersistedAppState(): Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const WRITE_DELAY = 300;

const pendingWrites = new Map<string, unknown>();
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleAppStateWrite(key: string, value: unknown): void {
  pendingWrites.set(key, value);
  const existingTimer = writeTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  writeTimers.set(
    key,
    setTimeout(() => {
      void flushAppStateWrite(key);
    }, WRITE_DELAY)
  );
}

async function flushAppStateWrite(key: string): Promise<void> {
  const timer = writeTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    writeTimers.delete(key);
  }
  const value = pendingWrites.get(key);
  if (value === undefined) {
    return;
  }
  pendingWrites.delete(key);
  try {
    await saveAppStateRecord(key, value);
  } catch {
    // Errors are reported by the repository through the persistence error
    // subscription and surfaced by the AppStateProvider.
  }
}

/** Writes all pending app-state records immediately (e.g. on unload). */
export async function flushAppStateWrites(): Promise<void> {
  const keys = [...writeTimers.keys()];
  for (const key of keys) {
    await flushAppStateWrite(key);
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [hydratedData, setHydratedData] = useState<HydratedData | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const data = await loadAllData();
      if (!active) {
        return;
      }
      setHydratedData(data);
      setPersistenceStatus(getBackendKind() === 'memory' ? 'degraded' : 'ready');
      setIsHydrated(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPersistenceErrors((message) => {
      setPersistenceError(message);
      setPersistenceStatus(getBackendKind() === 'memory' ? 'degraded' : 'error');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleUnload = () => {
      void flushAppStateWrites();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const getAppState = useCallback(
    (key: string) => hydratedData?.appState[key],
    [hydratedData]
  );

  const setAppState = useCallback((key: string, value: unknown) => {
    setHydratedData((current) =>
      current ? { ...current, appState: { ...current.appState, [key]: value } } : current
    );
    scheduleAppStateWrite(key, value);
  }, []);

  const clearPersistedAppState = useCallback(async () => {
    try {
      await clearAppStateStore();
    } catch {
      // Errors are surfaced via the persistence error subscription.
    }
    setHydratedData((current) => (current ? { ...current, appState: {} } : current));
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      isHydrated,
      persistenceStatus,
      persistenceError,
      hydratedData,
      getAppState,
      setAppState,
      clearPersistedAppState
    }),
    [isHydrated, persistenceStatus, persistenceError, hydratedData, getAppState, setAppState, clearPersistedAppState]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

export function useOptionalAppState(): AppStateContextValue | null {
  return useContext(AppStateContext);
}

/**
 * React state that is automatically persisted to the `appState` store.
 *
 * When no `AppStateProvider` is present (e.g. in tests that render a single
 * component), this degrades to a plain `useState` with no persistence.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const appState = useOptionalAppState();

  const [initialValue] = useState<T>(() => {
    if (appState) {
      const stored = appState.getAppState(key);
      if (stored !== undefined) {
        return stored as T;
      }
    }
    return defaultValue;
  });
  const [value, setValue] = useState<T>(initialValue);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setter = useCallback(
    (next: SetStateAction<T>) => {
      const resolved =
        typeof next === 'function' ? (next as (_previous: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      if (appState) {
        appState.setAppState(key, resolved);
      }
    },
    [appState, key]
  );

  return [value, setter];
}

/** Reports that a repository-level action failed (used by callers outside contexts). */
export function reportAppPersistenceError(message: string): void {
  reportPersistenceError(message);
}
