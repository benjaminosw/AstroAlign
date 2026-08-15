import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLandmarkSearch } from '../useLandmarkSearch';
import { GeocodingError } from '../types';
import type { GeocodingProvider, GeocodingResult } from '../types';

const SAMPLE: GeocodingResult = {
  id: 'mbs',
  name: 'Marina Bay Sands',
  locality: 'Singapore',
  country: 'Singapore',
  latitude: 1.2834,
  longitude: 103.8607
};

function providerReturning(results: GeocodingResult[]): { provider: GeocodingProvider; calls: string[] } {
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

describe('useLandmarkSearch', () => {
  it('does not search for queries shorter than the minimum length', async () => {
    vi.useFakeTimers();
    const { provider, calls } = providerReturning([SAMPLE]);
    const { result } = renderHook(() => useLandmarkSearch(provider, { debounceMs: 400, minLength: 3 }));

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
    const { result } = renderHook(() => useLandmarkSearch(provider, { debounceMs: 400, minLength: 3 }));

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

  it('reports a no-results state when the provider returns nothing', async () => {
    vi.useFakeTimers();
    const { provider } = providerReturning([]);
    const { result } = renderHook(() => useLandmarkSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Nowhereville');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state).toEqual({ status: 'no-results' });
  });

  it('reports a friendly network error message', async () => {
    vi.useFakeTimers();
    const provider: GeocodingProvider = {
      search: async () => {
        throw new GeocodingError('Unable to search for landmarks. Check your connection and try again.', 'network');
      }
    };
    const { result } = renderHook(() => useLandmarkSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toContain('Check your connection');
    }
  });

  it('reports a friendly rate-limit message', async () => {
    vi.useFakeTimers();
    const provider: GeocodingProvider = {
      search: async () => {
        throw new GeocodingError('Too many landmark searches. Please wait a moment and try again.', 'rate-limit');
      }
    };
    const { result } = renderHook(() => useLandmarkSearch(provider, { debounceMs: 400 }));

    await act(async () => {
      result.current.setQuery('Marina');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toContain('Too many landmark searches');
    }
  });
});
