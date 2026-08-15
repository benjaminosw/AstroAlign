'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { findAlignments } from '../lib/alignment/findAlignments';
import type { AlignmentCandidate } from '../lib/alignment/types';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import { formatResultDate } from '../lib/utils/formatResultDate';
import LocationControls from './LocationControls';
import TolerancePicker from './TolerancePicker';
import TimeFilterPicker from './TimeFilterPicker';
import StateButton from './StateButton';
import type { TimeFilterOption } from '../lib/alignment/timeFilter';

const WorkspaceMap = dynamic(() => import('./WorkspaceMap'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="workspace-map-loading"
      className="h-[460px] w-full rounded-2xl border border-slate-800 bg-slate-900 lg:h-[620px]"
    />
  )
});

interface AlignmentFinderProps {
  observer: GeographicPoint;
  target: Target;
  landmark?: SelectedLandmark | null;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
}

type SearchedInputs = {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  startDate: string | null;
  endDate: string | null;
  toleranceDegrees: number;
  fullMoonOnly: boolean;
  timeFilter: TimeFilterOption;
  customStartTime: string;
  customEndTime: string;
  landmarkName: string | null;
};

export default function AlignmentFinder({
  observer,
  target,
  landmark = null,
  timeZone,
  timeZoneStatus,
  observerCoordinateError,
  onObserverChange,
  onTargetChange,
  onSelectLandmark = () => {},
  onClearLandmark = () => {}
}: AlignmentFinderProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [activeMarker, setActiveMarker] = useState<'observer' | 'target'>('observer');
  const [showMatchesOnly, setShowMatchesOnly] = useState(true);
  const [fullMoonOnly, setFullMoonOnly] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>('any');
  const [customStartTime, setCustomStartTime] = useState('18:00');
  const [customEndTime, setCustomEndTime] = useState('07:00');
  const [results, setResults] = useState<AlignmentCandidate[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedInputs, setLastSearchedInputs] = useState<SearchedInputs | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mapFitId, setMapFitId] = useState(0);
  const [locationInputError, setLocationInputError] = useState(false);
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
    fullMoonOnly,
    timeFilter: object === ASTRO_OBJECT.Moon ? timeFilter : 'any',
    customStartTime: object === ASTRO_OBJECT.Moon ? customStartTime : '',
    customEndTime: object === ASTRO_OBJECT.Moon ? customEndTime : '',
    landmarkName: landmark?.name ?? null
  };

  const isCurrent = lastSearchedInputs !== null && isDeepEqual(lastSearchedInputs, currentInputs);

  const locationChanged =
    lastSearchedInputs !== null &&
    (lastSearchedInputs.observer.latitude !== observer.latitude ||
      lastSearchedInputs.observer.longitude !== observer.longitude ||
      lastSearchedInputs.target.latitude !== target.latitude ||
      lastSearchedInputs.target.longitude !== target.longitude ||
      lastSearchedInputs.landmarkName !== (landmark?.name ?? null));

  async function search() {
    if (locationInputError) {
      setError('Enter valid coordinates to search.');
      return;
    }

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
        timeFilter,
        customStartTime,
        customEndTime,
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

      const firstVisibleIndex = showMatchesOnly
        ? sorted.findIndex((candidate) => candidate.alignment.withinTolerance)
        : 0;

      setResults(sorted);
      setLastSearchedInputs({ ...currentInputs, landmarkName: landmark?.name ?? null });
      setSelectedIndex(firstVisibleIndex >= 0 ? firstVisibleIndex : null);
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

  useEffect(() => {
    if (results === null || visibleResults === null || visibleResults.length === 0) {
      return;
    }
    if (selectedIndex !== null && visibleResults[selectedIndex] === undefined) {
      setSelectedIndex(0);
    }
  }, [visibleResults, selectedIndex, results]);

  const selectedCandidate = visibleResults && selectedIndex !== null ? visibleResults[selectedIndex] ?? null : null;

  function handleSelectLandmark(selected: SelectedLandmark) {
    onSelectLandmark(selected);
    setMapFitId((id) => id + 1);
  }

  function handleObserverMove(latitude: number, longitude: number) {
    onObserverChange('latitude', String(latitude));
    onObserverChange('longitude', String(longitude));
  }

  function handleTargetMove(latitude: number, longitude: number) {
    onTargetChange('latitude', String(latitude));
    onTargetChange('longitude', String(longitude));
  }

  const selectedAlignment =
    selectedCandidate && lastSearchedInputs
      ? {
          object: lastSearchedInputs.object,
          objectAzimuth: selectedCandidate.object.azimuth,
          targetBearing: selectedCandidate.target.bearing,
          targetDistanceKm: selectedCandidate.target.distanceKm,
          angularSeparation: selectedCandidate.alignment.angularSeparation,
          toleranceDegrees: lastSearchedInputs.toleranceDegrees,
          withinTolerance: selectedCandidate.alignment.withinTolerance,
          azimuthLabel: `${selectedCandidate.eventLabel} azimuth`
        }
      : null;

  return (
    <div data-testid="finder-workspace" className="space-y-6">
      <LocationControls
        observer={observer}
        target={target}
        landmark={landmark}
        timeZone={timeZone}
        timeZoneStatus={timeZoneStatus}
        onObserverChange={onObserverChange}
        onTargetChange={onTargetChange}
        onSelectLandmark={handleSelectLandmark}
        onClearLandmark={onClearLandmark}
        onInputErrorChange={setLocationInputError}
      />

      <WorkspaceMap
        observer={observer}
        target={target}
        targetName={landmark?.name ?? null}
        activeLocation={activeMarker}
        onObserverMove={handleObserverMove}
        onTargetMove={handleTargetMove}
        onActivate={setActiveMarker}
        fitId={mapFitId}
        fitTarget="target"
        alignment={selectedAlignment}
        sun={
          selectedCandidate && lastSearchedInputs
            ? { object: lastSearchedInputs.object, azimuth: selectedCandidate.object.azimuth }
            : null
        }
        className="h-[460px] lg:h-[620px]"
      />

      <div data-testid="alignment-columns" className="grid items-start gap-6 lg:grid-cols-2">
        <section data-testid="alignment-settings-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment settings</h2>

          <div className="mt-4 space-y-4">
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

            {object === ASTRO_OBJECT.Moon && (
              <div className="space-y-4">
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

                <div>
                  <label htmlFor="find-time-filter" className="text-sm text-slate-300">
                    Time filter
                  </label>
                  <TimeFilterPicker
                    option={timeFilter}
                    customStartTime={customStartTime}
                    customEndTime={customEndTime}
                    onOptionChange={setTimeFilter}
                    onCustomStartChange={setCustomStartTime}
                    onCustomEndChange={setCustomEndTime}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="find-tolerance" className="text-sm text-slate-300">
                Maximum azimuth difference
              </label>
              <TolerancePicker id="find-tolerance" value={toleranceDegrees} onChange={setToleranceDegrees} />
              <p className="mt-2 text-xs text-slate-500">
                Search uses rise/set azimuth only; altitude is not used to match events.
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showMatchesOnly}
                onChange={(event) => setShowMatchesOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              Show only matches within tolerance
            </label>

            <div className="flex flex-wrap items-start gap-4">
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

              {error && (
                <div className="min-w-64 flex-1 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>

        <section data-testid="alignment-results-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment results</h2>
            {results !== null && (
              <p className="text-sm font-semibold text-white">
                {visibleResults?.length ?? 0} alignment{(visibleResults?.length ?? 0) === 1 ? '' : 's'}
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

          {results && !isCurrent && (
            <div
              role="status"
              className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
            >
              {locationChanged
                ? '⚠ Location changed — recalculate alignments. These results were calculated for the previous location.'
                : '⚠ Inputs changed — search again to update these results. The map shows the last searched alignment.'}
            </div>
          )}

          {results === null ? (
            status !== 'running' ? (
              <p className="mt-4 text-sm text-slate-500">Results will appear here after you search.</p>
            ) : null
          ) : visibleResults === null || visibleResults.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No alignments found within the selected range and tolerance.</p>
          ) : (
            <div className="mt-3 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-800 p-1.5">
              {visibleResults.map((candidate, index) => (
                <button
                  key={`${candidate.localDate}-${candidate.localTime}-${candidate.eventType}-${index}`}
                  type="button"
                  data-testid="alignment-result-item"
                  aria-pressed={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                  className={`grid w-full items-baseline gap-x-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    candidate.moonPhase
                      ? 'grid-cols-[1.25rem_5rem_minmax(0,1fr)_minmax(0,1fr)_3.25rem_minmax(0,1fr)]'
                      : 'grid-cols-[1.25rem_5rem_minmax(0,1fr)_minmax(0,1fr)_3.25rem]'
                  } ${selectedIndex === index ? 'bg-sky-500/10 text-white' : 'text-slate-300 hover:bg-slate-800/60'}`}
                >
                  <span aria-hidden="true" className="text-center">
                    {candidate.eventType === 'rise' ? '↑' : '↓'}
                  </span>
                  <span className="font-semibold">{candidate.eventLabel}</span>
                  <span className="whitespace-nowrap tabular-nums">{formatResultDate(candidate.localDate)}</span>
                  <span className="whitespace-nowrap tabular-nums">{candidate.localTime}</span>
                  <span className="whitespace-nowrap text-right tabular-nums text-slate-400">
                    {candidate.score.toFixed(2)}°
                    {candidate.alignment.withinTolerance && <span aria-hidden="true"> ✓</span>}
                  </span>
                  {candidate.moonPhase && (
                    <span
                      data-testid="moon-phase"
                      data-phase-name={candidate.moonPhase.name}
                      className="whitespace-nowrap text-right tabular-nums text-slate-400"
                      title={candidate.moonPhase.name}
                    >
                      <span aria-hidden="true">{candidate.moonPhase.emoji}</span>
                      <span className="hidden lg:inline"> {candidate.moonPhase.name}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
