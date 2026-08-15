'use client';

import { useEffect, useRef, useState } from 'react';
import { activeGeocoder } from './index';
import { GeocodingError } from './types';
import type { GeocodingProvider, GeocodingResult } from './types';

export type LandmarkSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; results: GeocodingResult[] }
  | { status: 'no-results' }
  | { status: 'error'; message: string };

const DEFAULT_DEBOUNCE_MS = 400;
const DEFAULT_MIN_QUERY_LENGTH = 3;

function friendlyErrorMessage(error: unknown): string {
  if (error instanceof GeocodingError && error.kind === 'rate-limit') {
    return 'Too many landmark searches. Please wait a moment and try again.';
  }
  return 'Unable to search for landmarks. Check your connection and try again.';
}

export function useLandmarkSearch(
  provider: GeocodingProvider = activeGeocoder,
  options: { debounceMs?: number; minLength?: number } = {}
) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, minLength = DEFAULT_MIN_QUERY_LENGTH } = options;
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LandmarkSearchState>({ status: 'idle' });
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < minLength) {
      setState({ status: 'idle' });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const handler = window.setTimeout(() => {
      setState({ status: 'loading' });
      provider
        .search(trimmed, { signal: controller.signal })
        .then((results) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setState(results.length > 0 ? { status: 'success', results } : { status: 'no-results' });
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          if ((error as Error).name === 'AbortError') {
            return;
          }
          setState({ status: 'error', message: friendlyErrorMessage(error) });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(handler);
      controller.abort();
    };
  }, [query, provider, debounceMs, minLength]);

  return { query, setQuery, state };
}
