'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { calculateAlignment } from '../lib/alignment/calculateAlignment';
import { getBodyHorizontalPosition } from '../lib/astronomy/position';
import { convertLocalTimeToUtc } from '../lib/timezone/convertLocalTimeToUtc';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import { formatResultDate } from '../lib/utils/formatResultDate';
import LocationControls from './LocationControls';
import TimePicker from './TimePicker';
import TolerancePicker from './TolerancePicker';
import StateButton from './StateButton';

const AUTO_CALC_DEBOUNCE_MS = 200;

const WorkspaceMap = dynamic(() => import('./WorkspaceMap'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="workspace-map-loading"
      className="h-[460px] w-full rounded-2xl border border-slate-800 bg-slate-900 lg:h-[620px]"
    />
  )
});

const OBJECT_SYMBOL: Record<AstroObject, string> = {
  Sun: '☀',
  Moon: '🌙'
};

interface AlignmentCalculatorProps {
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

interface ResultSnapshot {
  result: import('../lib/alignment/calculateAlignment').AlignmentResult;
  object: AstroObject;
  date: string;
  time: string;
  toleranceDegrees: number;
  landmarkName: string | null;
}

type CalculatedInputs = {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  date: string | null;
  time: string | null;
  toleranceDegrees: number;
};

export default function AlignmentCalculator({
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
}: AlignmentCalculatorProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [activeMarker, setActiveMarker] = useState<'observer' | 'target'>('observer');
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCalculatedInputs, setLastCalculatedInputs] = useState<CalculatedInputs | null>(null);
  const [mapFitId, setMapFitId] = useState(0);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [locationInputError, setLocationInputError] = useState(false);
  const [sunAzimuth, setSunAzimuth] = useState<number | null>(null);
  const autoCalcTimerRef = useRef<number | null>(null);
  const autoCalcVersionRef = useRef(0);

  useEffect(() => {
    if (date !== null && time !== null) {
      return;
    }
    if (!timeZone) {
      return;
    }
    const now = getLocalDateTimeForTimeZone(timeZone);
    if (date === null) {
      setDate(now.date);
    }
    if (time === null) {
      setTime(now.time);
    }
  }, [timeZone, date, time]);

  useEffect(() => {
    if (locationInputError || observerCoordinateError) {
      setSunAzimuth(null);
      return;
    }
    if (timeZoneStatus === 'loading' || !timeZone || !date || !time) {
      setSunAzimuth(null);
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const datetime = convertLocalTimeToUtc(date, time, timeZone);
        const position = getBodyHorizontalPosition(object, datetime, observer);
        setSunAzimuth(position.azimuth);
      } catch {
        setSunAzimuth(null);
      }
    }, AUTO_CALC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    date,
    time,
    object,
    observer,
    timeZone,
    timeZoneStatus,
    locationInputError,
    observerCoordinateError
  ]);

  const currentInputs: CalculatedInputs = {
    observer,
    target,
    object,
    date,
    time,
    toleranceDegrees
  };

  const isCurrent = lastCalculatedInputs !== null && isDeepEqual(lastCalculatedInputs, currentInputs);

  useEffect(() => {
    if (lastCalculatedInputs === null) {
      return;
    }
    if (locationInputError || observerCoordinateError) {
      return;
    }
    if (timeZoneStatus === 'loading' || !timeZone) {
      return;
    }
    if (!date || !time) {
      return;
    }

    const version = ++autoCalcVersionRef.current;
    setAutoUpdating(true);

    if (autoCalcTimerRef.current !== null) {
      window.clearTimeout(autoCalcTimerRef.current);
    }
    autoCalcTimerRef.current = window.setTimeout(() => {
      autoCalcTimerRef.current = null;
      if (version !== autoCalcVersionRef.current) {
        return;
      }
      try {
        const result = calculateAlignment({ observer, target, object, date, time, timeZone, toleranceDegrees });
        setSnapshot({ result, object, date, time, toleranceDegrees, landmarkName: landmark?.name ?? null });
        setLastCalculatedInputs(currentInputs);
        setError(null);
        setAutoError(null);
      } catch (exception) {
        setAutoError((exception as Error).message);
      } finally {
        setAutoUpdating(false);
      }
    }, AUTO_CALC_DEBOUNCE_MS);

    return () => {
      if (autoCalcTimerRef.current !== null) {
        window.clearTimeout(autoCalcTimerRef.current);
        autoCalcTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer.latitude, observer.longitude, target.latitude, target.longitude]);

  function submit() {
    if (locationInputError) {
      setError('Enter valid coordinates to calculate alignment.');
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

    if (!date || !time) {
      setError('Please pick a date and time.');
      return;
    }

    if (autoCalcTimerRef.current !== null) {
      window.clearTimeout(autoCalcTimerRef.current);
      autoCalcTimerRef.current = null;
    }
    autoCalcVersionRef.current += 1;
    setAutoUpdating(false);

    try {
      const result = calculateAlignment({ observer, target, object, date, time, timeZone, toleranceDegrees });
      setSnapshot({ result, object, date, time, toleranceDegrees, landmarkName: landmark?.name ?? null });
      setLastCalculatedInputs(currentInputs);
      setError(null);
      setAutoError(null);
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

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

  const alignment = snapshot
    ? {
        object: snapshot.object,
        objectAzimuth: snapshot.result.object.azimuth,
        targetBearing: snapshot.result.target.bearing,
        targetDistanceKm: snapshot.result.target.distanceKm,
        angularSeparation: snapshot.result.alignment.angularSeparation,
        toleranceDegrees: snapshot.toleranceDegrees,
        withinTolerance: snapshot.result.alignment.withinTolerance,
        azimuthLabel: `${snapshot.object} azimuth`
      }
    : null;

  return (
    <div data-testid="calculator-workspace" className="space-y-6">
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
        alignment={alignment}
        sun={sunAzimuth !== null ? { object, azimuth: sunAzimuth } : null}
        className="h-[460px] lg:h-[620px]"
      />

      <div data-testid="alignment-columns" className="grid items-start gap-6 lg:grid-cols-2">
        <section data-testid="alignment-settings-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment settings</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label htmlFor="calculate-object" className="text-sm text-slate-300">
                Astronomical object
              </label>
              <select
                id="calculate-object"
                value={object}
                onChange={(event) => setObject(event.target.value as AstroObject)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value={ASTRO_OBJECT.Sun}>Sun</option>
                <option value={ASTRO_OBJECT.Moon}>Moon</option>
              </select>
            </div>

            <div>
              <label htmlFor="calculate-date" className="text-sm text-slate-300">
                Date
              </label>
              <input
                id="calculate-date"
                type="date"
                value={date ?? ''}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <span className="text-sm text-slate-300">Time</span>
              <TimePicker label="Time" value={time ?? ''} onChange={setTime} />
            </div>

            <div>
              <label htmlFor="calculate-tolerance" className="text-sm text-slate-300">
                Alignment tolerance
              </label>
              <TolerancePicker id="calculate-tolerance" value={toleranceDegrees} onChange={setToleranceDegrees} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-start gap-4">
            <StateButton
              state={isCurrent ? 'current' : 'needsAction'}
              onClick={submit}
              needsActionLabel="Calculate alignment"
              currentLabel="✓ Calculated"
              testId="calculate-button"
            />

            {error && (
              <div className="min-w-64 flex-1 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">
                {error}
              </div>
            )}
          </div>
        </section>

        <section data-testid="alignment-result-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment result</h2>
            {snapshot && (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  snapshot.result.alignment.withinTolerance
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {snapshot.result.alignment.withinTolerance
                  ? `✓ Within ${snapshot.toleranceDegrees}°`
                  : `⚠ Outside ${snapshot.toleranceDegrees}°`}{' '}
                tolerance
              </span>
            )}
          </div>

          {snapshot && !isCurrent && (
            <div
              role="status"
              className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
            >
              ⚠ Inputs changed — recalculate to update this result. The map shows the last calculated alignment.
            </div>
          )}

          {autoUpdating && snapshot && (
            <div
              role="status"
              data-testid="auto-updating"
              className="mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300"
            >
              Updating alignment…
            </div>
          )}

          {autoError && snapshot && (
            <div
              role="status"
              className="mt-3 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200"
            >
              ⚠ Unable to update alignment — {autoError}. Previous result shown below.
            </div>
          )}

          {snapshot ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-lg font-semibold text-white">
                  {OBJECT_SYMBOL[snapshot.object]} {snapshot.object} · {formatResultDate(snapshot.date)} ·{' '}
                  {snapshot.time}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Target bearing</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {snapshot.result.target.bearing.toFixed(2)}°
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{snapshot.object} azimuth</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{snapshot.result.object.azimuth.toFixed(2)}°</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Difference</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {snapshot.result.alignment.angularSeparation.toFixed(2)}°
                  </p>
                </div>
              </div>

              <details data-testid="alignment-details" className="rounded-2xl border border-slate-800 bg-slate-900/50">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:text-white">
                  <span>Details</span>
                  <span aria-hidden="true">▾</span>
                </summary>
                <div className="grid gap-x-6 gap-y-3 border-t border-slate-800 px-4 py-4 text-sm sm:grid-cols-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Tolerance</span>
                    <span className="tabular-nums text-slate-200">{snapshot.toleranceDegrees}°</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Angular separation</span>
                    <span className="tabular-nums text-slate-200">
                      {snapshot.result.alignment.angularSeparation.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Azimuth difference</span>
                    <span className="tabular-nums text-slate-200">
                      {snapshot.result.alignment.azimuthDelta.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Altitude difference</span>
                    <span className="tabular-nums text-slate-200">
                      {snapshot.result.alignment.altitudeDelta.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">{snapshot.object} altitude</span>
                    <span className="tabular-nums text-slate-200">{snapshot.result.object.altitude.toFixed(2)}°</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Target altitude</span>
                    <span className="tabular-nums text-slate-200">{snapshot.result.target.altitude.toFixed(2)}°</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-400">Target distance</span>
                    <span className="tabular-nums text-slate-200">
                      {snapshot.result.target.distanceKm.toFixed(2)} km
                    </span>
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Results will appear here after you calculate.</p>
          )}
        </section>
      </div>
    </div>
  );
}
