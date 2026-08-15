'use client';

import { useEffect, useRef, useState } from 'react';
import { activeGeocoder } from './index';
import { GeocodingError } from './types';
import type { GeocodingService, LocationSearchResult } from './types';

export type LocationSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; results: LocationSearchResult[] }
  | { status: 'no-results'; message: string }
  | { status: 'error'; message: string };

export const DEFAULT_EMPTY_MESSAGE = 'No locations found. Try a different address, landmark or postal code.';
export const DEFAULT_ERROR_MESSAGE = 'Unable to search for this location. Please try again.';
export const DEFAULT_RATE_LIMIT_MESSAGE = 'Too many searches. Please wait a moment and try again.';

interface UseLocationSearchOptions {
  debounceMs?: number;
  minLength?: number;
  emptyMessage?: string;
  errorMessage?: string;
}

const DEFAULT_DEBOUNCE_MS = 400;
const DEFAULT_MIN_QUERY_LENGTH = 3;

function friendlyErrorMessage(error: unknown, errorMessage: string): string {
  if (error instanceof GeocodingError && error.kind === 'rate-limit') {
    return DEFAULT_RATE_LIMIT_MESSAGE;
  }
  return errorMessage;
}

export function useLocationSearch(
  provider: GeocodingService = activeGeocoder,
  options: UseLocationSearchOptions = {}
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minLength = DEFAULT_MIN_QUERY_LENGTH,
    emptyMessage = DEFAULT_EMPTY_MESSAGE,
    errorMessage = DEFAULT_ERROR_MESSAGE
  } = options;
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LocationSearchState>({ status: 'idle' });
  const requestIdRef = useRef(0);

  function runSearch(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < minLength) {
      setState({ status: 'idle' });
      return;
    }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setState({ status: 'loading' });
    provider
      .search(trimmed, { signal: controller.signal })
      .then((results) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setState(results.length > 0 ? { status: 'success', results } : { status: 'no-results', message: emptyMessage });
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setState({ status: 'error', message: friendlyErrorMessage(error, errorMessage) });
      });
  }

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < minLength) {
      setState({ status: 'idle' });
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const handler = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState({ status: 'loading' });
      provider
        .search(trimmed, { signal: controller.signal })
        .then((results) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setState(results.length > 0 ? { status: 'success', results } : { status: 'no-results', message: emptyMessage });
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          if ((error as Error).name === 'AbortError') {
            return;
          }
          setState({ status: 'error', message: friendlyErrorMessage(error, errorMessage) });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(handler);
      controller.abort();
      requestIdRef.current += 1;
    };
  }, [query, provider, debounceMs, minLength, emptyMessage, errorMessage]);

  function search(raw?: string) {
    runSearch(raw !== undefined ? raw : query);
  }

  return { query, setQuery, state, search };
}
