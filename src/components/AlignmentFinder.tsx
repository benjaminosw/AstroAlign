'use client';

import { useEffect, useRef, useState } from 'react';
import { findAlignments } from '../lib/alignment/findAlignments';
import type { AlignmentCandidate } from '../lib/alignment/types';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import { DEFAULT_OBSERVER } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import TolerancePicker from './TolerancePicker';

interface AlignmentFinderProps {
  observer: GeographicPoint;
  target: Target;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
}

const defaultTimeZone = getTimezoneFromCoordinates(DEFAULT_OBSERVER.latitude, DEFAULT_OBSERVER.longitude).timeZone;
const defaultLocalDateTime = getLocalDateTimeForTimeZone(defaultTimeZone);

export default function AlignmentFinder({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  observerCoordinateError
}: AlignmentFinderProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [startDate, setStartDate] = useState(defaultLocalDateTime.date);
  const [endDate, setEndDate] = useState(defaultLocalDateTime.date);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [showMatchesOnly, setShowMatchesOnly] = useState(true);
  const [fullMoonOnly, setFullMoonOnly] = useState(false);
  const [results, setResults] = useState<AlignmentCandidate[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    setResults(null);
  }, [
    object,
    startDate,
    endDate,
    toleranceDegrees,
    fullMoonOnly,
    observer.latitude,
    observer.longitude,
    observer.elevation,
    target.latitude,
    target.longitude,
    target.elevation
  ]);

  async function search() {
    if (observerCoordinateError) {
      setError(observerCoordinateError);
      setResults(null);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setError('Waiting for timezone detection to complete.');
      setResults(null);
      return;
    }

    if (!timeZone) {
      setError('Observer timezone is not available for the selected coordinates.');
      setResults(null);
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      setResults(null);
      return;
    }

    if (startDate > endDate) {
      setError('End date must be the same or after start date.');
      setResults(null);
      return;
    }

    if (!Number.isFinite(toleranceDegrees) || toleranceDegrees < 0) {
      setError('Maximum azimuth difference must be a non-negative number.');
      setResults(null);
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    setStatus('running');
    setError(null);
    setResults(null);
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
      setStatus('completed');
    } catch (searchError) {
      setError((searchError as Error).message === 'Search canceled' ? 'Search canceled.' : (searchError as Error).message);
      setStatus('idle');
      setResults(null);
    }
  }

  function cancelSearch() {
    abortController.current?.abort();
    setStatus('idle');
    setProgress(0);
  }

  const visibleResults = results ? (showMatchesOnly ? results.filter((candidate) => candidate.alignment.withinTolerance) : results) : null;

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-4">
        <div>
          <label className="block text-sm text-slate-300">Object</label>
          <select
            value={object}
            onChange={(event) => setObject(event.target.value as AstroObject)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value={ASTRO_OBJECT.Sun}>Sun</option>
            <option value={ASTRO_OBJECT.Moon}>Moon</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-300">Search from</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Search until</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Maximum azimuth difference</label>
          <TolerancePicker value={toleranceDegrees} onChange={setToleranceDegrees} />
          <p className="mt-2 text-xs text-slate-500">Search uses rise/set azimuth only; altitude is not used to match events.</p>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
            <input
              id="showMatchesOnly"
              type="checkbox"
              checked={showMatchesOnly}
              onChange={(event) => setShowMatchesOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="showMatchesOnly" className="text-sm text-slate-300">
              Show only matches within tolerance
            </label>
          </div>

          {object === ASTRO_OBJECT.Moon && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
              <input
                id="fullMoonOnly"
                type="checkbox"
                checked={fullMoonOnly}
                onChange={(event) => setFullMoonOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              <label htmlFor="fullMoonOnly" className="text-sm text-slate-300">
                Full Moon ±1 day only
              </label>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={search}
              disabled={status === 'running'}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find Alignments
            </button>
          </div>
        </div>

        {status === 'running' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
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
          <div className="rounded-3xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{error}</div>
        )}

        {visibleResults && (
          <div className="grid gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Search results</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {visibleResults.length} alignment{visibleResults.length === 1 ? '' : 's'} found
              </p>
            </div>

            {visibleResults.length === 0 ? (
              <p className="text-sm text-slate-400">No alignments found within the selected range and tolerance.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/90">
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
          </div>
        )}
      </section>
    </div>
  );
}
