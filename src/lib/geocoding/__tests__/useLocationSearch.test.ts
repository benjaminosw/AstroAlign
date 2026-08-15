import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocationSearch } from '../useLocationSearch';
import { GeocodingError } from '../types';
import type { GeocodingService, LocationSearchResult } from '../types';

const SAMPLE: LocationSearchResult = {
  id: 'mbs',
  name: 'Marina Bay Sands',
  formattedAddress: '10 Bayfront Avenue, Singapore 018956',
  latitude: 1.2834,
  longitude: 103.8607
};

function providerReturning(results: LocationSearchResult[]): {
  provider: GeocodingService;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    provider: {
      search: async (query: string) => {
        calls.push(query);
        return results;
      }
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useLocationSearch', () => {
  it('does not search for queries shorter than the minimum length', async () => {
    vi.useFakeTimers();
    const { provider, calls } = providerReturning([SAMPLE]);
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400, minLength: 3 }));

    await act(async () => {
      result.current.setQuery('Ma');
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(calls).toHaveLength(0);
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('debounces rapid typing so only the final query triggers a request', async () => {
    vi.useFakeTimers();
    const { provider, calls } = providerReturning([SAMPLE]);
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400, minLength: 3 }));

    await act(async () => {
      result.current.setQuery('M');
    });
    await act(async () => {
      result.current.setQuery('Ma');
    });
    await act(async () => {
      result.current.setQuery('Mar');
    });
    await act(async () => {
      vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
      result.current.setQuery('Marina');
    });
    await act(async () => {
      vi.advanceTimersByTimeAsync(500);
    });

    expect(calls).toEqual(['Marina']);
    expect(result.current.state).toEqual({ status: 'success', results: [SAMPLE] });
  });

  it('reports a no-results state with a helpful message', async () => {
    vi.useFakeTimers();
    const { provider } = providerReturning([]);
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Nowhereville');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state.status).toBe('no-results');
    if (result.current.state.status === 'no-results') {
      expect(result.current.state.message).toContain('No locations found');
    }
  });

  it('reports a friendly network error message', async () => {
    vi.useFakeTimers();
    const provider: GeocodingService = {
      search: async () => {
        throw new GeocodingError('boom', 'network');
      }
    };
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('Unable to search for this location. Please try again.');
    }
  });

  it('reports a friendly rate-limit message', async () => {
    vi.useFakeTimers();
    const provider: GeocodingService = {
      search: async () => {
        throw new GeocodingError('rate limited', 'rate-limit');
      }
    };
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toContain('Too many searches');
    }
  });

  it('runs an immediate search for the current query', async () => {
    vi.useFakeTimers();
    const { provider, calls } = providerReturning([SAMPLE]);
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina Bay Sands');
    });
    await act(async () => {
      result.current.search();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(calls).toEqual(['Marina Bay Sands']);
    expect(result.current.state).toEqual({ status: 'success', results: [SAMPLE] });
  });

  it('a pending debounced search does not fire after an immediate search', async () => {
    vi.useFakeTimers();
    const { provider, calls } = providerReturning([SAMPLE]);
    const { result } = renderHook(() => useLocationSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina Bay Sands');
    });
    await act(async () => {
      result.current.search();
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(calls).toEqual(['Marina Bay Sands']);
  });
});
