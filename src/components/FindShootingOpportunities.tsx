'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GeographicPoint, AstroObject } from '../types/astronomy';
import { ASTRO_OBJECT } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import type { ShootingArea, ShootingAreaMode, ShootingAreaPoint } from '../lib/opportunities/types';
import { findShootingOpportunities } from '../lib/opportunities/findShootingOpportunities';
import { filterShootingOpportunities } from '../lib/opportunities/filterOpportunities';
import { MOON_PHASE_BUCKETS } from '../lib/astronomy/lunarPhase';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import { destinationPoint } from '../lib/geometry/destinationPoint';
import { ALL_MOON_PHASES, useShootingState } from '../lib/opportunities/shootingState';
import type { SearchedInputs } from '../lib/opportunities/shootingState';
import TargetLocationPicker from './TargetLocationPicker';
import ShootingAreaControls from './ShootingAreaControls';
import ShootingOpportunityResults from './ShootingOpportunityResults';
import SaveTargetControl from './SaveTargetControl';
import SaveShootingLocationControl from './SaveShootingLocationControl';
import SaveSetupControl from './SaveSetupControl';
import TolerancePicker from './TolerancePicker';
import TimeFilterPicker from './TimeFilterPicker';
import StateButton from './StateButton';
import { useSavedLocations } from '../lib/saved/savedState';

const ShootingAreaMap = dynamic(() => import('./ShootingAreaMap'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="shooting-area-map-loading"
      className="h-[420px] w-full rounded-2xl border border-slate-800 bg-slate-900 lg:h-[520px]"
    />
  )
});

interface FindShootingOpportunitiesProps {
  target: GeographicPoint;
  landmark?: SelectedLandmark | null;
  targetCoordinateError: string | null;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
  onGoToSavedLocations?: () => void;
}

function buildDefaultArea(target: GeographicPoint, mode: ShootingAreaMode): ShootingArea {
  if (mode === 'path') {
    const start = destinationPoint(target.latitude, target.longitude, 225, 1.4);
    const end = destinationPoint(target.latitude, target.longitude, 45, 1.4);
    return {
      type: 'path',
      start: { id: 'start', name: 'Start', latitude: start.latitude, longitude: start.longitude },
      end: { id: 'end', name: 'End', latitude: end.latitude, longitude: end.longitude }
    };
  }
  const point = destinationPoint(target.latitude, target.longitude, 270, 1.0);
  return {
    type: 'points',
    points: [{ id: 'default-point-1', name: 'Point 1', latitude: point.latitude, longitude: point.longitude }]
  };
}

export default function FindShootingOpportunities({
  target,
  landmark = null,
  targetCoordinateError,
  timeZone,
  timeZoneStatus,
  onTargetChange,
  onSelectLandmark = () => {},
  onClearLandmark = () => {},
  onGoToSavedLocations = () => {}
}: FindShootingOpportunitiesProps) {
  const {
    object,
    setObject,
    eventType,
    setEventType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    toleranceDegrees,
    setToleranceDegrees,
    area: storedArea,
    setArea,
    areaTouched,
    setAreaTouched,
    fullMoonOnly,
    setFullMoonOnly,
    timeFilter,
    setTimeFilter,
    customStartTime,
    setCustomStartTime,
    customEndTime,
    setCustomEndTime,
    selectedMoonPhases,
    setSelectedMoonPhases,
    allOpportunities,
    setAllOpportunities,
    status,
    setStatus,
    progress,
    setProgress,
    error,
    setError,
    lastSearchedInputs,
    setLastSearchedInputs,
    selectedId,
    setSelectedId,
    viewport,
    setViewport,
    resetFilters
  } = useShootingState();
  const abortController = useRef<AbortController | null>(null);
  const [panRequest, setPanRequest] = useState<{ id: string; requestId: number } | null>(null);

  const defaultArea = useMemo(() => buildDefaultArea(target, 'path'), [target]);
  const area = storedArea ?? defaultArea;

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
  }, [timeZone, startDate, endDate, setStartDate, setEndDate]);

  useEffect(() => {
    if (storedArea !== null && areaTouched) {
      return;
    }
    if (storedArea !== null && isDeepEqual(storedArea, defaultArea)) {
      return;
    }
    setArea(defaultArea);
  }, [storedArea, areaTouched, defaultArea, setArea]);

  function handleAreaChange(nextArea: ShootingArea) {
    setArea(nextArea);
    setAreaTouched(true);
  }

  const currentInputs: SearchedInputs = {
    target,
    object,
    eventType,
    startDate,
    endDate,
    toleranceDegrees,
    area,
    landmarkName: landmark?.name ?? null
  };

  const isCurrent = lastSearchedInputs !== null && isDeepEqual(lastSearchedInputs, currentInputs);

  const defaultPoint = useMemo<ShootingAreaPoint>(() => {
    if (viewport) {
      return { id: 'default-point', name: '', latitude: viewport.latitude, longitude: viewport.longitude };
    }
    const point = destinationPoint(target.latitude, target.longitude, 270, 1.0);
    return { id: 'default-point', name: '', latitude: point.latitude, longitude: point.longitude };
  }, [viewport, target]);

  const cameraMarkers = useMemo(() => {
    if (area.type === 'path') {
      return [
        { id: 'start', label: 'Path start', latitude: area.start.latitude, longitude: area.start.longitude },
        { id: 'end', label: 'Path end', latitude: area.end.latitude, longitude: area.end.longitude }
      ];
    }
    return area.points.map((point, index) => ({
      id: point.id,
      label: point.name || `Point ${index + 1}`,
      latitude: point.latitude,
      longitude: point.longitude
    }));
  }, [area]);

  function handleModeChange(mode: ShootingAreaMode) {
    if (area.type === mode) {
      return;
    }
    if (mode === 'path') {
      if (area.type === 'points' && area.points.length >= 2) {
        const [start, end] = area.points;
        handleAreaChange({ type: 'path', start, end });
      } else {
        handleAreaChange(buildDefaultArea(target, 'path'));
      }
    } else {
      if (area.type === 'path') {
        handleAreaChange({ type: 'points', points: [area.start] });
      } else {
        handleAreaChange(buildDefaultArea(target, 'points'));
      }
    }
  }

  function handleAreaCameraMove(id: string, latitude: number, longitude: number) {
    if (area.type === 'path') {
      const which = id === 'start' ? 'start' : 'end';
      handleAreaChange({
        type: 'path',
        start: which === 'start' ? { ...area.start, latitude, longitude } : area.start,
        end: which === 'end' ? { ...area.end, latitude, longitude } : area.end
      });
      return;
    }
    handleAreaChange({
      type: 'points',
      points: area.points.map((point) => (point.id === id ? { ...point, latitude, longitude } : point))
    });
  }

  function handleTargetMove(latitude: number, longitude: number) {
    onTargetChange('latitude', String(latitude));
    onTargetChange('longitude', String(longitude));
  }

  function handleSelectLandmark(selected: SelectedLandmark) {
    onSelectLandmark(selected);
  }

  function handleSelectFromList(id: string) {
    setSelectedId(id);
    setPanRequest({ id, requestId: Date.now() });
  }

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
      const found = await findShootingOpportunities({
        target,
        area,
        object,
        eventType,
        startDate,
        endDate,
        toleranceDegrees,
        timeZone,
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgress((completed / total) * 100);
        }
      });

      setAllOpportunities(found);
      setLastSearchedInputs({ ...currentInputs });
      setSelectedId(found[0]?.id ?? null);
      setStatus('completed');
    } catch (searchError) {
      setError(
        (searchError as Error).message === 'Search canceled' ? 'Search canceled.' : (searchError as Error).message
      );
      setStatus('idle');
    }
  }

  function cancelSearch() {
    abortController.current?.abort();
    setStatus('idle');
    setProgress(0);
  }

  const searchedObject = lastSearchedInputs?.object ?? object;

  const visibleOpportunities = useMemo(() => {
    if (allOpportunities === null) {
      return [];
    }
    return filterShootingOpportunities(allOpportunities, {
      moonPhases: searchedObject === ASTRO_OBJECT.Moon ? selectedMoonPhases : null,
      timeFilter: searchedObject === ASTRO_OBJECT.Moon ? timeFilter : 'any',
      customStartTime,
      customEndTime,
      fullMoonOnly: searchedObject === ASTRO_OBJECT.Moon && fullMoonOnly
    });
  }, [allOpportunities, searchedObject, selectedMoonPhases, timeFilter, customStartTime, customEndTime, fullMoonOnly]);

  const filtersActive =
    searchedObject === ASTRO_OBJECT.Moon &&
    (timeFilter !== 'any' || fullMoonOnly || selectedMoonPhases.length !== ALL_MOON_PHASES.length);

  function togglePhase(phaseName: string) {
    setSelectedMoonPhases((prev) =>
      prev.includes(phaseName) ? prev.filter((name) => name !== phaseName) : [...prev, phaseName]
    );
  }

  useEffect(() => {
    if (allOpportunities === null || visibleOpportunities.length === 0) {
      return;
    }
    if (selectedId !== null && !visibleOpportunities.some((opportunity) => opportunity.id === selectedId)) {
      setSelectedId(visibleOpportunities[0].id);
    }
  }, [visibleOpportunities, selectedId, allOpportunities, setSelectedId]);

  const selectedOpportunity =
    visibleOpportunities.find((opportunity) => opportunity.id === selectedId) ?? visibleOpportunities[0] ?? null;

  const { findTargetByCoordinates, boundTargetId, boundShootingLocationId, shootingLocations, setups } =
    useSavedLocations();
  const shootingTargetId = findTargetByCoordinates(target.latitude, target.longitude)?.id ?? boundTargetId ?? null;
  const boundLocation =
    (boundShootingLocationId && shootingLocations.find((location) => location.id === boundShootingLocationId)) ?? null;
  const boundSetup =
    shootingTargetId && boundShootingLocationId
      ? (setups.find(
          (setup) => setup.targetId === shootingTargetId && setup.shootingLocationId === boundShootingLocationId
        ) ?? null)
      : null;

  const highlight = selectedOpportunity
    ? {
        zoneStartKm: selectedOpportunity.position.zoneStartKm,
        zoneEndKm: selectedOpportunity.position.zoneEndKm
      }
    : null;

  return (
    <div data-testid="shooting-opportunities-workspace" className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-8">
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Target</h2>
                <SaveTargetControl target={target} landmarkName={landmark?.name ?? null} />
              </div>
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
              idPrefix="shooting-area-target"
              target={target}
              landmark={landmark}
              onTargetChange={onTargetChange}
              onSelectLandmark={handleSelectLandmark}
              onClearLandmark={onClearLandmark}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-8">
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Shooting area</h2>
              <div className="flex flex-wrap items-center gap-2">
                <SaveShootingLocationControl area={area} />
                <SaveSetupControl
                  target={target}
                  landmarkName={landmark?.name ?? null}
                  area={area}
                  onGoToSavedLocations={onGoToSavedLocations}
                />
              </div>
            </div>
            <ShootingAreaControls
              area={area}
              defaultPoint={defaultPoint}
              onModeChange={handleModeChange}
              onAreaChange={setArea}
            />
          </section>
        </div>
      </div>

      <ShootingAreaMap
        target={target}
        targetName={landmark?.name ?? null}
        area={area}
        cameraMarkers={cameraMarkers}
        onTargetMove={handleTargetMove}
        onAreaCameraMove={handleAreaCameraMove}
        highlight={highlight}
        opportunities={visibleOpportunities}
        selectedId={selectedId}
        onSelect={setSelectedId}
        panRequest={panRequest}
        initialViewport={viewport}
        onViewportChange={setViewport}
      />

      <div data-testid="shooting-columns" className="grid items-start gap-6 lg:grid-cols-2">
        <section
          data-testid="shooting-settings-card"
          className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Search settings</h2>

          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shooting-area-object" className="text-sm text-slate-300">
                  Object
                </label>
                <select
                  id="shooting-area-object"
                  value={object}
                  onChange={(event) => setObject(event.target.value as AstroObject)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value={ASTRO_OBJECT.Sun}>Sun</option>
                  <option value={ASTRO_OBJECT.Moon}>Moon</option>
                </select>
              </div>
              <div>
                <label htmlFor="shooting-area-event" className="text-sm text-slate-300">
                  Event
                </label>
                <select
                  id="shooting-area-event"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as 'rise' | 'set')}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="rise">Rise</option>
                  <option value="set">Set</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shooting-area-start" className="text-sm text-slate-300">
                  Search from
                </label>
                <input
                  id="shooting-area-start"
                  type="date"
                  value={startDate ?? ''}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label htmlFor="shooting-area-end" className="text-sm text-slate-300">
                  Search until
                </label>
                <input
                  id="shooting-area-end"
                  type="date"
                  value={endDate ?? ''}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="shooting-area-tolerance" className="text-sm text-slate-300">
                Maximum azimuth difference
              </label>
              <TolerancePicker id="shooting-area-tolerance" value={toleranceDegrees} onChange={setToleranceDegrees} />
              <p className="mt-2 text-xs text-slate-500">
                Maximum difference between the target bearing and the Sun/Moon rise/set azimuth.
              </p>
            </div>

            {object === ASTRO_OBJECT.Moon && (
              <div className="space-y-4">
                <div>
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
                          id={`shooting-area-phase-${phase.name}`}
                          type="checkbox"
                          checked={selectedMoonPhases.includes(phase.name)}
                          onChange={() => togglePhase(phase.name)}
                          className="h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                        />
                        <span aria-hidden="true">{phase.emoji}</span>
                        <label htmlFor={`shooting-area-phase-${phase.name}`} className="text-sm text-slate-300">
                          {phase.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-300">
                    <input
                      id="shooting-area-full-moon"
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

            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-56 flex-1">
                <StateButton
                  state={isCurrent ? 'current' : 'needsAction'}
                  onClick={search}
                  needsActionLabel="Find opportunities"
                  currentLabel="✓ Searched"
                  running={status === 'running'}
                  runningLabel="Searching…"
                  accentClasses="bg-violet-500 text-slate-950 hover:bg-violet-400"
                  testId="find-opportunities-button"
                />
              </div>
            </div>

            {status === 'running' && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <p>Searching for shooting opportunities…</p>
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
          </div>
        </section>

        <ShootingOpportunityResults
          allResults={allOpportunities}
          visibleResults={visibleOpportunities}
          searchedObject={searchedObject}
          filtersActive={filtersActive}
          isCurrent={isCurrent}
          selectedId={selectedId}
          onSelect={handleSelectFromList}
          onResetFilters={resetFilters}
          selectedOpportunity={selectedOpportunity}
          target={target}
          toleranceDegrees={toleranceDegrees}
          targetId={shootingTargetId}
          shootingSetupId={boundSetup?.id ?? null}
          shootingLocationSnapshot={
            boundLocation ? { name: boundLocation.name, geometry: boundLocation.geometry } : null
          }
          onGoToSettings={onGoToSavedLocations}
        />
      </div>
    </div>
  );
}
