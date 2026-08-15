'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { findAlignments } from '../lib/alignment/findAlignments';
import type { AlignmentCandidate } from '../lib/alignment/types';
import { filterAlignmentResults } from '../lib/alignment/filterResults';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { collectFullMoonInstants, isWithinFullMoonWindow, MOON_PHASE_BUCKETS } from '../lib/astronomy/lunarPhase';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { convertLocalTimeToUtc } from '../lib/timezone/convertLocalTimeToUtc';
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
  observerLandmark?: SelectedLandmark | null;
  landmark?: SelectedLandmark | null;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  onSelectObserverLandmark?: (_landmark: SelectedLandmark) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearObserverLandmark?: () => void;
  onClearLandmark?: () => void;
}

type SearchedInputs = {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  startDate: string | null;
  endDate: string | null;
  toleranceDegrees: number;
  landmarkName: string | null;
};

const ALL_MOON_PHASES = MOON_PHASE_BUCKETS.map((bucket) => bucket.name);

export default function AlignmentFinder({
  observer,
  target,
  observerLandmark = null,
  landmark = null,
  timeZone,
  timeZoneStatus,
  observerCoordinateError,
  onObserverChange,
  onTargetChange,
  onSelectObserverLandmark = () => {},
  onSelectLandmark = () => {},
  onClearObserverLandmark = () => {},
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
  const [selectedMoonPhases, setSelectedMoonPhases] = useState<string[]>(ALL_MOON_PHASES);
  const [allAlignmentResults, setAllAlignmentResults] = useState<AlignmentCandidate[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedInputs, setLastSearchedInputs] = useState<SearchedInputs | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mapFitId, setMapFitId] = useState(0);
  const [fitLocation, setFitLocation] = useState<'observer' | 'target'>('target');
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

      setAllAlignmentResults(sorted);
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

  const searchedObject = lastSearchedInputs?.object ?? object;

  const filteredByMoonFilters = useMemo(() => {
    if (allAlignmentResults === null) {
      return null;
    }
    return filterAlignmentResults(allAlignmentResults, {
      moonPhases: searchedObject === ASTRO_OBJECT.Moon ? selectedMoonPhases : null,
      timeFilter: searchedObject === ASTRO_OBJECT.Moon ? timeFilter : 'any',
      customStartTime,
      customEndTime
    });
  }, [allAlignmentResults, searchedObject, selectedMoonPhases, timeFilter, customStartTime, customEndTime]);

  const fullMoonInstants = useMemo(() => {
    if (!fullMoonOnly || searchedObject !== ASTRO_OBJECT.Moon || !timeZone || !lastSearchedInputs) {
      return [];
    }
    const { startDate, endDate } = lastSearchedInputs;
    if (!startDate || !endDate) {
      return [];
    }
    const startUtc = convertLocalTimeToUtc(startDate, '00:00:00', timeZone);
    const endUtc = convertLocalTimeToUtc(endDate, '23:59:59', timeZone);
    return collectFullMoonInstants(startUtc, endUtc);
  }, [fullMoonOnly, searchedObject, timeZone, lastSearchedInputs]);

  const visibleResults = useMemo(() => {
    if (filteredByMoonFilters === null) {
      return null;
    }
    let list = filteredByMoonFilters;
    if (fullMoonOnly && searchedObject === ASTRO_OBJECT.Moon) {
      list = list.filter((candidate) => isWithinFullMoonWindow(new Date(candidate.utcInstant), fullMoonInstants));
    }
    if (showMatchesOnly) {
      list = list.filter((candidate) => candidate.alignment.withinTolerance);
    }
    return list;
  }, [filteredByMoonFilters, fullMoonOnly, fullMoonInstants, showMatchesOnly, searchedObject]);

  const filtersActive =
    searchedObject === ASTRO_OBJECT.Moon &&
    (timeFilter !== 'any' || fullMoonOnly || selectedMoonPhases.length !== ALL_MOON_PHASES.length);

  const totalCount = allAlignmentResults?.length ?? 0;
  const shownCount = visibleResults?.length ?? 0;

  function resetFilters() {
    setSelectedMoonPhases(ALL_MOON_PHASES);
    setTimeFilter('any');
    setCustomStartTime('18:00');
    setCustomEndTime('07:00');
    setFullMoonOnly(false);
  }

  function togglePhase(phaseName: string) {
    setSelectedMoonPhases((prev) =>
      prev.includes(phaseName) ? prev.filter((name) => name !== phaseName) : [...prev, phaseName]
    );
  }

  useEffect(() => {
    if (allAlignmentResults === null || visibleResults === null || visibleResults.length === 0) {
      return;
    }
    if (selectedIndex !== null && visibleResults[selectedIndex] === undefined) {
      setSelectedIndex(0);
    }
  }, [visibleResults, selectedIndex, allAlignmentResults]);

  const selectedCandidate = visibleResults && selectedIndex !== null ? visibleResults[selectedIndex] ?? null : null;

  function handleSelectObserverLandmark(selected: SelectedLandmark) {
    onSelectObserverLandmark(selected);
    setFitLocation('observer');
    setMapFitId((id) => id + 1);
  }

  function handleSelectLandmark(selected: SelectedLandmark) {
    onSelectLandmark(selected);
    setFitLocation('target');
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
        observerLandmark={observerLandmark}
        landmark={landmark}
        timeZone={timeZone}
        timeZoneStatus={timeZoneStatus}
        onObserverChange={onObserverChange}
        onTargetChange={onTargetChange}
        onSelectObserverLandmark={handleSelectObserverLandmark}
        onSelectLandmark={handleSelectLandmark}
        onClearObserverLandmark={onClearObserverLandmark}
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
        fitTarget={fitLocation}
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
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="find-time-filter" className="text-sm text-slate-300">
                      Time filter
                    </label>
                  </div>
                  <TimeFilterPicker
                    option={timeFilter}
                    customStartTime={customStartTime}
                    customEndTime={customEndTime}
                    onOptionChange={setTimeFilter}
                    onCustomStartChange={setCustomStartTime}
                    onCustomEndChange={setCustomEndTime}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-300">Moon phase</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMoonPhases(ALL_MOON_PHASES)}
                        className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-sky-300 transition hover:bg-slate-800"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMoonPhases([])}
                        className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-sky-300 transition hover:bg-slate-800"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {MOON_PHASE_BUCKETS.map((phase) => (
                      <div
                        key={phase.name}
                        className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2"
                      >
                        <input
                          id={`find-phase-${phase.name}`}
                          type="checkbox"
                          checked={selectedMoonPhases.includes(phase.name)}
                          onChange={() => togglePhase(phase.name)}
                          className="h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                        />
                        <span aria-hidden="true">{phase.emoji}</span>
                        <label htmlFor={`find-phase-${phase.name}`} className="text-sm text-slate-300">
                          {phase.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-300">
                    <input
                      id="find-full-moon"
                      type="checkbox"
                      checked={fullMoonOnly}
                      onChange={(event) => setFullMoonOnly(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                    />
                    Full Moon date window
                  </label>
                  <p className="mt-1.5 pl-4 text-xs text-slate-500">
                    Include dates ±1 day from exact Full Moon only.
                  </p>
                </div>

                {filtersActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    Clear filters
                  </button>
                )}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment results</h2>
            {allAlignmentResults !== null && (
              <p data-testid="results-count" className="text-sm font-semibold text-white">
                {shownCount !== totalCount || filtersActive
                  ? `${totalCount} alignments found · ${shownCount} shown`
                  : `${shownCount} alignment${shownCount === 1 ? '' : 's'}`}
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

          {allAlignmentResults && !isCurrent && (
            <div
              role="status"
              className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
            >
              {locationChanged
                ? '⚠ Location changed — recalculate alignments. These results were calculated for the previous location.'
                : '⚠ Inputs changed — search again to update these results. The map shows the last searched alignment.'}
            </div>
          )}

          {allAlignmentResults === null ? (
            status !== 'running' ? (
              <p className="mt-4 text-sm text-slate-500">Results will appear here after you search.</p>
            ) : null
          ) : allAlignmentResults.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No alignments found within the selected range and tolerance.</p>
          ) : searchedObject === ASTRO_OBJECT.Moon && selectedMoonPhases.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-slate-200">No Moon phases selected.</p>
              <p className="mt-1 text-sm text-slate-400">Select at least one phase to display results.</p>
            </div>
          ) : visibleResults === null || visibleResults.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-slate-200">No results match the current filters.</p>
              <p className="mt-1 text-sm text-slate-400">
                {totalCount} alignment{totalCount === 1 ? ' was' : 's were'} calculated.
              </p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
                >
                  Clear filters
                </button>
              )}
            </div>
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
