'use client';

import { useEffect, useRef, useState } from 'react';
import { findAlignments } from '../lib/alignment/findAlignments';
import type { AlignmentCandidate } from '../lib/alignment/types';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import LocationInputs from './LocationInputs';
import TolerancePicker from './TolerancePicker';
import StateButton from './StateButton';

interface AlignmentFinderProps {
  observer: GeographicPoint;
  target: Target;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
}

type SearchedInputs = {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  startDate: string | null;
  endDate: string | null;
  toleranceDegrees: number;
  fullMoonOnly: boolean;
};

export default function AlignmentFinder({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  observerCoordinateError,
  onObserverChange,
  onTargetChange
}: AlignmentFinderProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [showMatchesOnly, setShowMatchesOnly] = useState(true);
  const [fullMoonOnly, setFullMoonOnly] = useState(false);
  const [results, setResults] = useState<AlignmentCandidate[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedInputs, setLastSearchedInputs] = useState<SearchedInputs | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (startDate !== null && endDate !== null) {
      return;
    }
    if (!timeZone) {
      return;
    }
    const now = getLocalDateTimeForTimeZone(timeZone);
    if (startDate === null) {
      setStartDate(now.date);
    }
    if (endDate === null) {
      setEndDate(now.date);
    }
  }, [timeZone, startDate, endDate]);

  const currentInputs: SearchedInputs = {
    observer,
    target,
    object,
    startDate,
    endDate,
    toleranceDegrees,
    fullMoonOnly
  };

  const isCurrent = lastSearchedInputs !== null && isDeepEqual(lastSearchedInputs, currentInputs);

  async function search() {
    if (observerCoordinateError) {
      setError(observerCoordinateError);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setError('Waiting for timezone detection to complete.');
      return;
    }

    if (!timeZone) {
      setError('Observer timezone is not available for the selected coordinates.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    if (startDate > endDate) {
      setError('End date must be the same or after start date.');
      return;
    }

    if (!Number.isFinite(toleranceDegrees) || toleranceDegrees < 0) {
      setError('Maximum azimuth difference must be a non-negative number.');
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    setStatus('running');
    setError(null);
    setProgress(0);

    try {
      const found = await findAlignments({
        observer,
        target,
        object,
        startDate,
        endDate,
        toleranceDegrees,
        timeZone,
        fullMoonOnly,
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgress((completed / total) * 100);
        }
      });

      const sorted = [...found].sort((a, b) => {
        const dateCompare = a.localDate.localeCompare(b.localDate);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return a.localTime.localeCompare(b.localTime);
      });

      setResults(sorted);
      setLastSearchedInputs(currentInputs);
      setStatus('completed');
    } catch (searchError) {
      setError((searchError as Error).message === 'Search canceled' ? 'Search canceled.' : (searchError as Error).message);
      setStatus('idle');
    }
  }

  function cancelSearch() {
    abortController.current?.abort();
    setStatus('idle');
    setProgress(0);
  }

  const visibleResults = results ? (showMatchesOnly ? results.filter((candidate) => candidate.alignment.withinTolerance) : results) : null;

  return (
    <div
      data-testid="finder-workspace"
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,5fr)_minmax(0,8fr)]"
    >
      <div className="lg:sticky lg:top-8">
        <LocationInputs
          observer={observer}
          target={target}
          timeZone={timeZone}
          timeZoneStatus={timeZoneStatus}
          observerCoordinateError={observerCoordinateError}
          onObserverChange={onObserverChange}
          onTargetChange={onTargetChange}
        />
      </div>

      <div className="lg:sticky lg:top-8">
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Search</h2>

          <div>
            <label htmlFor="find-object" className="text-sm text-slate-300">
              Object
            </label>
            <select
              id="find-object"
              value={object}
              onChange={(event) => setObject(event.target.value as AstroObject)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value={ASTRO_OBJECT.Sun}>Sun</option>
              <option value={ASTRO_OBJECT.Moon}>Moon</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="find-start" className="text-sm text-slate-300">
                Search from
              </label>
              <input
                id="find-start"
                type="date"
                value={startDate ?? ''}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div>
              <label htmlFor="find-end" className="text-sm text-slate-300">
                Search until
              </label>
              <input
                id="find-end"
                type="date"
                value={endDate ?? ''}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="find-tolerance" className="text-sm text-slate-300">
              Maximum azimuth difference
            </label>
            <TolerancePicker id="find-tolerance" value={toleranceDegrees} onChange={setToleranceDegrees} />
            <p className="mt-2 text-xs text-slate-500">Search uses rise/set azimuth only; altitude is not used to match events.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showMatchesOnly}
                onChange={(event) => setShowMatchesOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              Show only matches within tolerance
            </label>

            {object === ASTRO_OBJECT.Moon && (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-300">
                <input
                  id="find-full-moon"
                  type="checkbox"
                  checked={fullMoonOnly}
                  onChange={(event) => setFullMoonOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                Full Moon ±1 day only
              </label>
            )}
          </div>

          <StateButton
            state={isCurrent ? 'current' : 'needsAction'}
            onClick={search}
            needsActionLabel="Find alignments"
            currentLabel="✓ Searched"
            running={status === 'running'}
            runningLabel="Searching…"
            accentClasses="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            testId="find-button"
          />
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Search results</p>
          {results !== null && (
            <p className="text-2xl font-semibold text-white">
              {visibleResults?.length ?? 0} alignment{(visibleResults?.length ?? 0) === 1 ? '' : 's'} found
            </p>
          )}
        </div>

        {status === 'running' && (
          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <p>Searching for alignments…</p>
              <button
                type="button"
                onClick={cancelSearch}
                className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
              >
                Cancel Search
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">{Math.round(progress)}% complete</p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{error}</div>
        )}

        {results && !isCurrent && (
          <div
            role="status"
            className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
          >
            ⚠ Inputs changed — search again to update these results
          </div>
        )}

        {results === null ? (
          status !== 'running' ? (
            <p className="mt-4 text-sm text-slate-500">Results will appear here after you search.</p>
          ) : null
        ) : visibleResults === null || visibleResults.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No alignments found within the selected range and tolerance.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/90">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Local time</th>
                  <th className="px-4 py-3 font-medium">Azimuth difference</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((candidate, index) => (
                  <tr key={`${candidate.localDate}-${candidate.localTime}-${index}`} className="border-b border-slate-800 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {candidate.eventType === 'rise' ? '↑ ' : '↓ '}
                      {candidate.eventLabel}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{candidate.localDate}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{candidate.localTime}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-100">{candidate.score.toFixed(3)}°</td>
                    <td className="px-4 py-3">
                      {candidate.alignment.withinTolerance ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                          Match
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                          Outside
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
