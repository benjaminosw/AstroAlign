'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { findShootingLocations } from '../lib/reverseSearch/findShootingLocations';
import type { ReverseSearchResult } from '../lib/reverseSearch/types';
import { buildCorridorGeometry } from '../lib/reverseSearch/corridorGeometry';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import TolerancePicker from './TolerancePicker';
import SearchRadiusPicker from './SearchRadiusPicker';
import StateButton from './StateButton';
import TargetLocationPicker from './TargetLocationPicker';
import ShootingLocationResults from './ShootingLocationResults';

const ShootingLocationMap = dynamic(() => import('./ShootingLocationMap'), {
  ssr: false,
  loading: () => (
    <div data-testid="map-loading" className="h-[440px] w-full rounded-2xl border border-slate-800 bg-slate-900" />
  )
});

interface FindShootingLocationsProps {
  target: Target;
  landmark?: SelectedLandmark | null;
  targetCoordinateError: string | null;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
}

type MoonPhaseMode = 'all' | 'full-moon';

interface SearchedInputs {
  target: GeographicPoint;
  object: AstroObject;
  date: string | null;
  eventType: 'rise' | 'set';
  toleranceDegrees: number;
  searchRadiusKm: number;
  fullMoonOnly: boolean;
}

export default function FindShootingLocations({
  target,
  landmark = null,
  targetCoordinateError,
  timeZone,
  timeZoneStatus,
  onTargetChange,
  onSelectLandmark = () => {},
  onClearLandmark = () => {}
}: FindShootingLocationsProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [date, setDate] = useState<string | null>(null);
  const [eventType, setEventType] = useState<'rise' | 'set'>('rise');
  const [moonPhaseMode, setMoonPhaseMode] = useState<MoonPhaseMode>('all');
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [searchRadiusKm, setSearchRadiusKm] = useState(10);
  const [results, setResults] = useState<ReverseSearchResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSearchedInputs, setLastSearchedInputs] = useState<SearchedInputs | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (date !== null) {
      return;
    }
    if (!timeZone) {
      return;
    }
    const now = getLocalDateTimeForTimeZone(timeZone);
    setDate(now.date);
  }, [timeZone, date]);

  const currentInputs: SearchedInputs = {
    target,
    object,
    date,
    eventType,
    toleranceDegrees,
    searchRadiusKm,
    fullMoonOnly: object === ASTRO_OBJECT.Moon && moonPhaseMode === 'full-moon'
  };

  const isCurrent = lastSearchedInputs !== null && isDeepEqual(lastSearchedInputs, currentInputs);

  async function search() {
    if (targetCoordinateError) {
      setError(targetCoordinateError);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setError('Waiting for timezone detection to complete.');
      return;
    }

    if (!timeZone) {
      setError('Target timezone is not available for the selected coordinates.');
      return;
    }

    if (!date) {
      setError('Please pick a date.');
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    setStatus('running');
    setError(null);
    setProgress(0);
    setResults(null);
    setSelectedId(null);

    try {
      const found = await findShootingLocations({
        target,
        date,
        timeZone,
        object,
        eventType,
        toleranceDegrees,
        searchRadiusKm,
        fullMoonOnly: object === ASTRO_OBJECT.Moon && moonPhaseMode === 'full-moon',
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgress((completed / total) * 100);
        }
      });

      setResults(found);
      setSelectedId(found.candidates[0]?.id ?? null);
      setLastSearchedInputs(currentInputs);
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

  const corridor =
    results && lastSearchedInputs
      ? buildCorridorGeometry(target, results.idealOutboundBearing, lastSearchedInputs.toleranceDegrees, lastSearchedInputs.searchRadiusKm)
      : null;

  return (
    <div data-testid="shooting-workspace" className="grid gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-8">
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-white">Target</h2>
              {timeZoneStatus === 'loading' ? (
                <span className="text-xs text-slate-400">Detecting timezone…</span>
              ) : timeZoneStatus === 'error' ? (
                <span className="text-xs text-rose-300">Timezone unavailable</span>
              ) : timeZone ? (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200">
                  {timeZone}
                </span>
              ) : (
                <span className="text-xs text-slate-500">Enter valid coordinates to detect timezone</span>
              )}
            </div>
            {targetCoordinateError && <p className="text-xs text-rose-300">{targetCoordinateError}</p>}
            <TargetLocationPicker
              idPrefix="shooting-target"
              target={target}
              landmark={landmark}
              onTargetChange={onTargetChange}
              onSelectLandmark={onSelectLandmark}
              onClearLandmark={onClearLandmark}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-8">
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Reverse search</h2>

            <div>
              <label htmlFor="shooting-date" className="text-sm text-slate-300">
                Date
              </label>
              <input
                id="shooting-date"
                type="date"
                value={date ?? ''}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shooting-object" className="text-sm text-slate-300">
                  Object
                </label>
                <select
                  id="shooting-object"
                  value={object}
                  onChange={(event) => setObject(event.target.value as AstroObject)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value={ASTRO_OBJECT.Sun}>Sun</option>
                  <option value={ASTRO_OBJECT.Moon}>Moon</option>
                </select>
              </div>
              <div>
                <label htmlFor="shooting-event" className="text-sm text-slate-300">
                  Event
                </label>
                <select
                  id="shooting-event"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as 'rise' | 'set')}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="rise">Rise</option>
                  <option value="set">Set</option>
                </select>
              </div>
            </div>

            {object === ASTRO_OBJECT.Moon && (
              <div>
                <label htmlFor="shooting-moon-phase" className="text-sm text-slate-300">
                  Moon phase
                </label>
                <select
                  id="shooting-moon-phase"
                  value={moonPhaseMode}
                  onChange={(event) => setMoonPhaseMode(event.target.value as MoonPhaseMode)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="all">All moon phases</option>
                  <option value="full-moon">Full Moon ±1 day</option>
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shooting-radius" className="text-sm text-slate-300">
                  Search radius
                </label>
                <SearchRadiusPicker id="shooting-radius" value={searchRadiusKm} onChange={setSearchRadiusKm} />
              </div>
              <div>
                <label htmlFor="shooting-tolerance" className="text-sm text-slate-300">
                  Alignment tolerance
                </label>
                <TolerancePicker id="shooting-tolerance" value={toleranceDegrees} onChange={setToleranceDegrees} />
                <p className="mt-2 text-xs text-slate-500">
                  Maximum difference between the target bearing and the Sun/Moon rise/set azimuth.
                </p>
              </div>
            </div>

            <StateButton
              state={isCurrent ? 'current' : 'needsAction'}
              onClick={search}
              needsActionLabel="Find locations"
              currentLabel="✓ Searched"
              running={status === 'running'}
              runningLabel="Searching…"
              accentClasses="bg-violet-500 text-slate-950 hover:bg-violet-400"
              testId="find-locations-button"
            />

            {status === 'running' && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <p>Finding shooting locations…</p>
                  <button
                    type="button"
                    onClick={cancelSearch}
                    className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Cancel Search
                  </button>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">{Math.round(progress)}% complete</p>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{error}</div>
            )}
          </section>
        </div>
      </div>

      <div>
        {results && corridor ? (
          <ShootingLocationMap
            target={target}
            candidates={results.candidates}
            idealLine={corridor.idealLine}
            corridorPolygon={corridor.corridorPolygon}
            searchCircle={corridor.searchCircle}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <div className="flex h-[440px] w-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 text-sm text-slate-500">
            The map with the target, ideal alignment line, corridor and candidate locations will appear here after a
            search.
          </div>
        )}
      </div>

      <ShootingLocationResults
        result={results}
        isCurrent={isCurrent}
        selectedId={selectedId}
        onSelect={setSelectedId}
        target={target}
        targetName={landmark?.name ?? null}
        timeZone={timeZone}
      />
    </div>
  );
}
