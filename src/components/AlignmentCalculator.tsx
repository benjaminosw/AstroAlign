'use client';

import { useEffect, useState } from 'react';
import { calculateAlignment, AlignmentResult } from '../lib/alignment/calculateAlignment';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { isDeepEqual } from '../lib/utils/searchUtils';
import LocationInputs from './LocationInputs';
import TimePicker from './TimePicker';
import TolerancePicker from './TolerancePicker';
import StateButton from './StateButton';

interface AlignmentCalculatorProps {
  observer: GeographicPoint;
  target: Target;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
}

interface ResultSnapshot {
  result: AlignmentResult;
  object: AstroObject;
  date: string;
  time: string;
  toleranceDegrees: number;
}

type CalculatedInputs = {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  date: string | null;
  time: string | null;
  toleranceDegrees: number;
};

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = Number(month) - 1;
  return `${Number(day)} ${months[monthIndex]} ${year}`;
}

export default function AlignmentCalculator({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  observerCoordinateError,
  onObserverChange,
  onTargetChange
}: AlignmentCalculatorProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCalculatedInputs, setLastCalculatedInputs] = useState<CalculatedInputs | null>(null);

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

  const currentInputs: CalculatedInputs = {
    observer,
    target,
    object,
    date,
    time,
    toleranceDegrees
  };

  const isCurrent = lastCalculatedInputs !== null && isDeepEqual(lastCalculatedInputs, currentInputs);

  function submit() {
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

    try {
      const result = calculateAlignment({ observer, target, object, date, time, timeZone, toleranceDegrees });
      setSnapshot({ result, object, date, time, toleranceDegrees });
      setLastCalculatedInputs(currentInputs);
      setError(null);
    } catch (exception) {
      setError((exception as Error).message);
    }
  }

  return (
    <div
      data-testid="calculator-workspace"
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment</h2>

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

          <StateButton
            state={isCurrent ? 'current' : 'needsAction'}
            onClick={submit}
            needsActionLabel="Calculate alignment"
            currentLabel="✓ Calculated"
            testId="calculate-button"
          />
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Alignment result</p>
        </div>

        {snapshot && !isCurrent && (
          <div
            role="status"
            className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
          >
            ⚠ Inputs changed — recalculate to update this result
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{error}</div>
        )}

        {snapshot ? (
          <div>
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
              <p className="text-lg font-semibold text-white">
                {snapshot.object} · {formatDisplayDate(snapshot.date)} · {snapshot.time}
              </p>
              <p className="mt-1 text-xs text-slate-400">Tolerance {snapshot.toleranceDegrees}°</p>
            </div>

            <div
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                snapshot.result.alignment.withinTolerance
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              {snapshot.result.alignment.withinTolerance
                ? `✓ Within ${snapshot.toleranceDegrees}° tolerance`
                : `⚠ Outside ${snapshot.toleranceDegrees}° tolerance`}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-3 rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{snapshot.object.toUpperCase()}</p>
                <div>
                  <p className="text-sm text-slate-400">Azimuth</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.object.azimuth.toFixed(2)}°</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Altitude</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.object.altitude.toFixed(2)}°</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Target</p>
                <div>
                  <p className="text-sm text-slate-400">Distance</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.target.distanceKm.toFixed(2)} km</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Bearing</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.target.bearing.toFixed(2)}°</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Altitude</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.target.altitude.toFixed(2)}°</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-900/80 p-4 sm:col-span-2 xl:col-span-1">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alignment</p>
                <div>
                  <p className="text-sm text-slate-400">Angular separation</p>
                  <p className="text-2xl font-semibold text-white">
                    {snapshot.result.alignment.angularSeparation.toFixed(2)}°
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Azimuth difference</p>
                  <p className="text-2xl font-semibold text-white">{snapshot.result.alignment.azimuthDelta.toFixed(2)}°</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Altitude difference</p>
                  <p className="text-2xl font-semibold text-white">
                    {snapshot.result.alignment.altitudeDelta.toFixed(2)}°
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Results will appear here after you calculate.</p>
        )}
      </section>
    </div>
  );
}
