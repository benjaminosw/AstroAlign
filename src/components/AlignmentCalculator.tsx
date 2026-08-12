'use client';

import { useEffect, useState } from 'react';
import { calculateAlignment, AlignmentInput, AlignmentResult } from '../lib/alignment/calculateAlignment';
import { AstroObject, Target } from '../types/astronomy';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { validateCoordinates as validateCoordinateValues } from '../lib/timezone/validateCoordinates';

const defaultTimeZone = getTimezoneFromCoordinates(DEFAULT_OBSERVER.latitude, DEFAULT_OBSERVER.longitude).timeZone;
const defaultLocalDateTime = getLocalDateTimeForTimeZone(defaultTimeZone);

const defaultInput: AlignmentInput = {
  observer: DEFAULT_OBSERVER,
  target: DEFAULT_TARGET,
  object: AstroObject.Sun,
  date: defaultLocalDateTime.date,
  time: defaultLocalDateTime.time,
  toleranceDegrees: 0.5
};

const toleranceOptions = [0.1, 0.25, 0.5, 1, 2];

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step="any"
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />
    </label>
  );
}

export default function AlignmentCalculator() {
  const [input, setInput] = useState<AlignmentInput>(defaultInput);
  const [result, setResult] = useState<AlignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [timeZoneStatus, setTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  function handleInputChange(field: keyof AlignmentInput, value: unknown) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function handleObserverChange(field: keyof Target, value: string) {
    setInput((prev) => ({
      ...prev,
      observer: { ...prev.observer, [field]: Number(value) }
    }));
  }

  function handleTargetChange(field: keyof Target, value: string) {
    setInput((prev) => ({
      ...prev,
      target: { ...prev.target, [field]: Number(value) }
    }));
  }

  function getCoordinateValidationError(latitude: number, longitude: number): string | null {
    return validateCoordinateValues(latitude, longitude);
  }

  function submit() {
    if (observerCoordinateError) {
      setError(observerCoordinateError);
      setResult(null);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setError('Waiting for timezone detection to complete.');
      setResult(null);
      return;
    }

    if (!timeZone) {
      setError('Observer timezone is not available for the selected coordinates.');
      setResult(null);
      return;
    }

    try {
      const nextResult = calculateAlignment({
        ...input,
        timeZone
      });
      setResult(nextResult);
      setError(null);
    } catch (exception) {
      setError((exception as Error).message);
      setResult(null);
    }
  }

  const observerCoordinateError = getCoordinateValidationError(input.observer.latitude, input.observer.longitude);

  const formattedTimezone = timeZone && input.date && input.time ? formatTimezoneLabel(input.date, input.time, timeZone) : null;

  useEffect(() => {
    const error = getCoordinateValidationError(input.observer.latitude, input.observer.longitude);

    if (error) {
      setTimeZoneStatus('idle');
      setTimeZone(null);
      return;
    }

    setTimeZoneStatus('loading');
    const handler = window.setTimeout(() => {
      try {
        const lookup = getTimezoneFromCoordinates(input.observer.latitude, input.observer.longitude);
        setTimeZone(lookup.timeZone);
        setTimeZoneStatus('idle');
      } catch (lookupError) {
        setTimeZone(null);
        setTimeZoneStatus('error');
      }
    }, 250);

    return () => window.clearTimeout(handler);
  }, [input.observer.latitude, input.observer.longitude]);

  return (
    <div className="grid gap-8 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/30 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-xl font-semibold text-white">Observer</h2>
          <NumberField label="Latitude" value={String(input.observer.latitude)} onChange={(value) => handleObserverChange('latitude', value)} />
          <NumberField label="Longitude" value={String(input.observer.longitude)} onChange={(value) => handleObserverChange('longitude', value)} />
          <NumberField label="Elevation (m)" value={String(input.observer.elevation)} onChange={(value) => handleObserverChange('elevation', value)} />

          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-slate-200">
            <p className="font-medium text-slate-100">Timezone</p>
            {observerCoordinateError ? (
              <p className="mt-2 text-rose-300">{observerCoordinateError}</p>
            ) : timeZoneStatus === 'loading' ? (
              <p className="mt-2 text-slate-300">Detecting timezone…</p>
            ) : timeZoneStatus === 'error' ? (
              <p className="mt-2 text-rose-300">Unable to determine timezone for this location.</p>
            ) : formattedTimezone ? (
              <>
                <p className="mt-2 text-slate-100">{formattedTimezone}</p>
                <p className="mt-1 text-xs text-slate-500">Automatically detected from observer location</p>
              </>
            ) : (
              <p className="mt-2 text-slate-300">Enter valid observer coordinates to detect timezone.</p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-xl font-semibold text-white">Target</h2>
          <NumberField label="Latitude" value={String(input.target.latitude)} onChange={(value) => handleTargetChange('latitude', value)} />
          <NumberField label="Longitude" value={String(input.target.longitude)} onChange={(value) => handleTargetChange('longitude', value)} />
          <NumberField label="Elevation (m)" value={String(input.target.elevation)} onChange={(value) => handleTargetChange('elevation', value)} />
        </section>
      </div>

      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-3">
        <div>
          <label className="block text-sm text-slate-300">Astronomical object</label>
          <select
            value={input.object}
            onChange={(event) => handleInputChange('object', event.target.value as AstroObject)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value={AstroObject.Sun}>Sun</option>
            <option value={AstroObject.Moon}>Moon</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-300">Date</label>
          <input
            type="date"
            value={input.date}
            onChange={(event) => handleInputChange('date', event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300">Time</label>
          <input
            type="time"
            value={input.time}
            onChange={(event) => handleInputChange('time', event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="mt-2 text-xs text-slate-500">Local civil time at the observer's location.</p>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-3">
        <div>
          <label className="block text-sm text-slate-300">Alignment tolerance</label>
          <select
            value={input.toleranceDegrees}
            onChange={(event) => handleInputChange('toleranceDegrees', Number(event.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            {toleranceOptions.map((option) => (
              <option key={option} value={option}>
                {option}°
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 flex items-end">
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
        <div className="rounded-3xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-3">
          <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{input.object.toUpperCase()}</p>
            <div>
              <p className="text-sm text-slate-400">Azimuth</p>
              <p className="text-2xl font-semibold text-white">{result.object.azimuth.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Altitude</p>
              <p className="text-2xl font-semibold text-white">{result.object.altitude.toFixed(2)}°</p>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Target</p>
            <div>
              <p className="text-sm text-slate-400">Distance</p>
              <p className="text-2xl font-semibold text-white">{result.target.distanceKm.toFixed(2)} km</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Bearing</p>
              <p className="text-2xl font-semibold text-white">{result.target.bearing.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Altitude</p>
              <p className="text-2xl font-semibold text-white">{result.target.altitude.toFixed(2)}°</p>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alignment</p>
            <div>
              <p className="text-sm text-slate-400">Angular separation</p>
              <p className="text-2xl font-semibold text-white">{result.alignment.angularSeparation.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Azimuth difference</p>
              <p className="text-2xl font-semibold text-white">{result.alignment.azimuthDelta.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Altitude difference</p>
              <p className="text-2xl font-semibold text-white">{result.alignment.altitudeDelta.toFixed(2)}°</p>
            </div>
            <div className="mt-2 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
              {result.alignment.withinTolerance ? (
                <p className="text-emerald-300">✓ Within {input.toleranceDegrees}° tolerance</p>
              ) : (
                <p className="text-amber-300">Outside {input.toleranceDegrees}° tolerance</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
