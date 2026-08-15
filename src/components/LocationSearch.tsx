'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { LocationSearchResult } from '../lib/geocoding/types';
import { useLocationSearch } from '../lib/geocoding/useLocationSearch';
import { activeGeocoder } from '../lib/geocoding';

interface LocationSearchProps {
  idPrefix: string;
  placeholder: string;
  ariaLabel: string;
  onSelect: (_result: LocationSearchResult) => void;
  emptyMessage?: string;
  errorMessage?: string;
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      data-testid="location-search-loading"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
    />
  );
}

function resultSubtitle(result: LocationSearchResult): string {
  if (result.formattedAddress) {
    return result.formattedAddress;
  }
  return `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`;
}

export default function LocationSearch({
  idPrefix,
  placeholder,
  ariaLabel,
  onSelect,
  emptyMessage,
  errorMessage
}: LocationSearchProps) {
  const { query, setQuery, state, search } = useLocationSearch(activeGeocoder, { emptyMessage, errorMessage });
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = `${idPrefix}-search`;
  const listboxId = `${idPrefix}-search-listbox`;
  const results = state.status === 'success' ? state.results : [];
  const showDropdown =
    open &&
    (state.status === 'loading' || state.status === 'success' || state.status === 'no-results' || state.status === 'error');

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [query, state]);

  function selectResult(result: LocationSearchResult) {
    onSelect(result);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setOpen(value.trim().length > 0);
  }

  function runSearchNow() {
    if (query.trim().length === 0) {
      return;
    }
    search(query);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (state.status === 'success') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((index) => Math.min(index + 1, results.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((index) => Math.max(index - 1, -1));
        return;
      }
      if (event.key === 'Enter' && highlightIndex >= 0) {
        event.preventDefault();
        const result = results[highlightIndex];
        if (result) {
          selectResult(result);
        }
        return;
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearchNow();
    }
  }

  const loading = state.status === 'loading';

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(query.trim().length > 0)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-3 pr-16 text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {loading ? (
            <span className="px-1">
              <LoadingSpinner />
            </span>
          ) : (
            <>
              {query.length > 0 && (
                <button
                  type="button"
                  aria-label={`Clear ${ariaLabel} search`}
                  title="Clear search"
                  onClick={() => {
                    setQuery('');
                    setOpen(false);
                  }}
                  className="rounded-md px-1 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                aria-label={`Search ${ariaLabel}`}
                title="Search"
                onClick={runSearchNow}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-sky-300"
              >
                <SearchIcon />
              </button>
            </>
          )}
        </div>
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${ariaLabel} search results`}
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          {loading && (
            <li className="px-4 py-3 text-sm text-slate-400" role="status">
              Searching…
            </li>
          )}

          {state.status === 'error' && <li className="px-4 py-3 text-sm text-rose-300">{state.message}</li>}

          {state.status === 'no-results' && <li className="px-4 py-3 text-sm text-slate-400">{state.message}</li>}

          {state.status === 'success' &&
            results.map((result, index) => (
              <li key={result.id} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectResult(result);
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`block w-full px-4 py-2.5 text-left transition ${
                    index === highlightIndex ? 'bg-slate-800' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-white">{result.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{resultSubtitle(result)}</p>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
