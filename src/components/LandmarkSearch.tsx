'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { GeocodingResult } from '../lib/geocoding/types';
import { useLandmarkSearch } from '../lib/geocoding/useLandmarkSearch';

interface LandmarkSearchProps {
  onSelect: (_result: GeocodingResult) => void;
  ariaLabel?: string;
}

const SEARCH_INPUT_ID = 'landmark-search';

function resultSubtitle(result: GeocodingResult): string {
  const parts = [result.locality, result.country].filter((part): part is string => Boolean(part));
  if (parts.length > 0) {
    return parts.join(', ');
  }
  return `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`;
}

export default function LandmarkSearch({ onSelect, ariaLabel = 'Landmark' }: LandmarkSearchProps) {
  const { query, setQuery, state } = useLandmarkSearch();
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

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

  function selectResult(result: GeocodingResult) {
    onSelect(result);
    setQuery('');
    setOpen(false);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setOpen(value.trim().length > 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (state.status !== 'success') {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter' && highlightIndex >= 0) {
      event.preventDefault();
      const result = results[highlightIndex];
      if (result) {
        selectResult(result);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={SEARCH_INPUT_ID} className="text-sm text-slate-300">
        {ariaLabel}
      </label>
      <div className="relative mt-2">
        <input
          id={SEARCH_INPUT_ID}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="landmark-search-listbox"
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder="Search for a landmark..."
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(query.trim().length > 0)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-3 pr-9 text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
        {query.length > 0 ? (
          <button
            type="button"
            aria-label="Clear landmark search"
            title="Clear landmark search"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md px-1 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ×
          </button>
        ) : (
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            🔍
          </span>
        )}
      </div>

      {showDropdown && (
        <ul
          id="landmark-search-listbox"
          role="listbox"
          aria-label="Landmark search results"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          {state.status === 'loading' && (
            <li className="px-4 py-3 text-sm text-slate-400" role="status">
              Searching…
            </li>
          )}

          {state.status === 'error' && <li className="px-4 py-3 text-sm text-rose-300">{state.message}</li>}

          {state.status === 'no-results' && (
            <li className="px-4 py-3 text-sm text-slate-400">
              No landmarks found. Try a different search term.
            </li>
          )}

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
                  <p className="text-xs text-slate-400">{resultSubtitle(result)}</p>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
