'use client';

import { useEffect, useState } from 'react';
import { calculateAlignment, AlignmentResult } from '../lib/alignment/calculateAlignment';
import { ASTRO_OBJECT, AstroObject, GeographicPoint, Target } from '../types/astronomy';
import { DEFAULT_OBSERVER } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import TimePicker from './TimePicker';
import TolerancePicker from './TolerancePicker';

interface AlignmentCalculatorProps {
  observer: GeographicPoint;
  target: Target;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
}

interface ResultSnapshot {
  result: AlignmentResult;
  object: AstroObject;
  date: string;
  time: string;
  toleranceDegrees: number;
}

const defaultTimeZone = getTimezoneFromCoordinates(DEFAULT_OBSERVER.latitude, DEFAULT_OBSERVER.longitude).timeZone;
const defaultLocalDateTime = getLocalDateTimeForTimeZone(defaultTimeZone);

export default function AlignmentCalculator({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  observerCoordinateError
}: AlignmentCalculatorProps) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [date, setDate] = useState(defaultLocalDateTime.date);
  const [time, setTime] = useState(defaultLocalDateTime.time);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(null);
  }, [
    object,
    date,
    time,
    toleranceDegrees,
    observer.latitude,
    observer.longitude,
    observer.elevation,
    target.latitude,
    target.longitude,
    target.elevation
  ]);

  function submit() {
    if (observerCoordinateError) {
      setError(observerCoordinateError);
      setSnapshot(null);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setError('Waiting for timezone detection to complete.');
      setSnapshot(null);
      return;
    }

    if (!timeZone) {
      setError('Observer timezone is not available for the selected coordinates.');
      setSnapshot(null);
      return;
    }

    try {
      const result = calculateAlignment({ observer, target, object, date, time, timeZone, toleranceDegrees });
      setSnapshot({ result, object, date, time, toleranceDegrees });
      setError(null);
    } catch (exception) {
      setError((exception as Error).message);
      setSnapshot(null);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-3">
        <div>
          <label className="block text-sm text-slate-300">Astronomical object</label>
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
          <label className="block text-sm text-slate-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Time</label>
          <TimePicker value={time} onChange={setTime} />
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-2">
        <div>
          <label className="block text-sm text-slate-300">Alignment tolerance</label>
          <TolerancePicker value={toleranceDegrees} onChange={setToleranceDegrees} />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={submit}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Calculate alignment
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{error}</div>
      )}

      {snapshot && (
        <section className="grid gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Alignment result</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {snapshot.object} · {snapshot.date} at {snapshot.time} · {snapshot.toleranceDegrees}° tolerance
            </p>
          </div>

          <div className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-3">
            <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
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

            <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
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

            <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alignment</p>
              <div>
                <p className="text-sm text-slate-400">Angular separation</p>
                <p className="text-2xl font-semibold text-white">{snapshot.result.alignment.angularSeparation.toFixed(2)}°</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Azimuth difference</p>
                <p className="text-2xl font-semibold text-white">{snapshot.result.alignment.azimuthDelta.toFixed(2)}°</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Altitude difference</p>
                <p className="text-2xl font-semibold text-white">{snapshot.result.alignment.altitudeDelta.toFixed(2)}°</p>
              </div>
              <div className="mt-2 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
                {snapshot.result.alignment.withinTolerance ? (
                  <p className="text-emerald-300">✓ Within {snapshot.toleranceDegrees}° tolerance</p>
                ) : (
                  <p className="text-amber-300">Outside {snapshot.toleranceDegrees}° tolerance</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
