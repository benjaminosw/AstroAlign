'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateAlignment, AlignmentInput, AlignmentResult } from '../lib/alignment/calculateAlignment';
import { findAlignments } from '../lib/alignment/findAlignments';
import type { AlignmentCandidate } from '../lib/alignment/types';
import { getAlignmentQuality, getAlignmentStars } from '../lib/alignment/alignmentQuality';
import { ASTRO_OBJECT, AstroObject, Target } from '../types/astronomy';
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
  object: ASTRO_OBJECT.Sun,
  date: defaultLocalDateTime.date,
  time: defaultLocalDateTime.time,
  toleranceDegrees: 0.5
};

const toleranceOptions = [0.1, 0.25, 0.5, 1, 2];

function NumberField({ label, fieldValue, onChange, placeholder }: { label: string; fieldValue: string; onChange: (_value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        type="number"
        value={fieldValue}
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
  const [searchResults, setSearchResults] = useState<AlignmentCandidate[] | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [searchProgress, setSearchProgress] = useState<number>(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStartDate, setSearchStartDate] = useState(defaultLocalDateTime.date);
  const [searchEndDate, setSearchEndDate] = useState(defaultLocalDateTime.date);
  const [searchTolerance, setSearchTolerance] = useState(0.5);
  const [searchSortBy, setSearchSortBy] = useState<'date' | 'best'>('date');
  const [showMatchesOnly, setShowMatchesOnly] = useState(true);
  const [fullMoonOnly, setFullMoonOnly] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);

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

  function handleSearchTolerance(value: string) {
    setSearchTolerance(Number(value));
  }

  function handleStartDate(value: string) {
    setSearchStartDate(value);
  }

  function handleEndDate(value: string) {
    setSearchEndDate(value);
  }

  function handleSortBy(value: 'date' | 'best') {
    setSearchSortBy(value);
  }

  function handleShowMatchesOnly(value: boolean) {
    setShowMatchesOnly(value);
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

  async function searchAlignments() {
    if (observerCoordinateError) {
      setSearchError(observerCoordinateError);
      setSearchResults(null);
      return;
    }

    if (timeZoneStatus === 'loading') {
      setSearchError('Waiting for timezone detection to complete.');
      setSearchResults(null);
      return;
    }

    if (!timeZone) {
      setSearchError('Observer timezone is not available for the selected coordinates.');
      setSearchResults(null);
      return;
    }

    if (!searchStartDate || !searchEndDate) {
      setSearchError('Start date and end date are required.');
      setSearchResults(null);
      return;
    }

    if (searchStartDate > searchEndDate) {
      setSearchError('End date must be the same or after start date.');
      setSearchResults(null);
      return;
    }

    if (!Number.isFinite(searchTolerance) || searchTolerance < 0) {
      setSearchError('Maximum azimuth difference must be a non-negative number.');
      setSearchResults(null);
      return;
    }

    searchAbortController.current?.abort();
    const controller = new AbortController();
    searchAbortController.current = controller;

    setSearchStatus('running');
    setSearchError(null);
    setSearchResults(null);
    setSearchProgress(0);

    try {
      const results = await findAlignments({
        observer: input.observer,
        target: input.target,
        object: input.object,
        startDate: searchStartDate,
        endDate: searchEndDate,
        toleranceDegrees: searchTolerance,
        timeZone,
        fullMoonOnly,
        signal: controller.signal,
        onProgress: (completed, total) => {
          setSearchProgress((completed / total) * 100);
        }
      });

      const filtered = showMatchesOnly ? results.filter((result) => result.alignment.withinTolerance) : results;
      const sorted = [...filtered].sort((a, b) => {
        if (searchSortBy === 'best') {
          return a.score - b.score;
        }
        return new Date(`${a.localDate}T${a.localTime}`).getTime() - new Date(`${b.localDate}T${b.localTime}`).getTime();
      });

      setSearchResults(sorted);
      setSearchStatus('completed');
    } catch (error) {
      if ((error as Error).message === 'Search canceled') {
        setSearchError('Search canceled.');
      } else {
        setSearchError((error as Error).message);
      }
      setSearchStatus('idle');
      setSearchResults(null);
    }
  }

  function cancelSearch() {
    searchAbortController.current?.abort();
    setSearchStatus('idle');
    setSearchProgress(0);
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
          <NumberField label="Latitude" fieldValue={String(input.observer.latitude)} onChange={(value) => handleObserverChange('latitude', value)} />
          <NumberField label="Longitude" fieldValue={String(input.observer.longitude)} onChange={(value) => handleObserverChange('longitude', value)} />
          <NumberField label="Elevation (m)" fieldValue={String(input.observer.elevation)} onChange={(value) => handleObserverChange('elevation', value)} />

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
          <NumberField label="Latitude" fieldValue={String(input.target.latitude)} onChange={(value) => handleTargetChange('latitude', value)} />
          <NumberField label="Longitude" fieldValue={String(input.target.longitude)} onChange={(value) => handleTargetChange('longitude', value)} />
          <NumberField label="Elevation (m)" fieldValue={String(input.target.elevation)} onChange={(value) => handleTargetChange('elevation', value)} />
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
            <option value={ASTRO_OBJECT.Sun}>Sun</option>
            <option value={ASTRO_OBJECT.Moon}>Moon</option>
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
          <p className="mt-2 text-xs text-slate-500">Local civil time at the observer&apos;s location.</p>
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

      <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Find Alignments</h2>
          <p className="text-sm text-slate-300">Search for Sun/Moon rise and set events that align with the target azimuth.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div>
            <label className="block text-sm text-slate-300">Object</label>
            <select
              value={input.object}
              onChange={(event) => handleInputChange('object', event.target.value as AstroObject)}
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
              value={searchStartDate}
              onChange={(event) => handleStartDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300">Search until</label>
            <input
              type="date"
              value={searchEndDate}
              onChange={(event) => handleEndDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300">Maximum azimuth difference</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={searchTolerance}
              onChange={(event) => handleSearchTolerance(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <p className="mt-2 text-xs text-slate-500">Search uses rise/set azimuth only; altitude is not used to match events.</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
            <input
              id="showMatchesOnly"
              type="checkbox"
              checked={showMatchesOnly}
              onChange={(event) => handleShowMatchesOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="showMatchesOnly" className="text-sm text-slate-300">
              Show only matches within tolerance
            </label>
          </div>

          {input.object === ASTRO_OBJECT.Moon && (
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
              onClick={searchAlignments}
              disabled={searchStatus === 'running'}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find Alignments
            </button>
          </div>
        </div>

        {searchStatus === 'running' && (
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
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${searchProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">{Math.round(searchProgress)}% complete</p>
          </div>
        )}

        {searchError && (
          <div className="rounded-3xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">
            {searchError}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {searchResults && (
        <section className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Search Results</p>
              <p className="mt-2 text-2xl font-semibold text-white">{searchResults.length} alignments found</p>
            </div>
          </div>

          <div className="grid gap-4">
            {searchResults.map((resultItem, index) => (
              <details key={`${resultItem.localDate}-${resultItem.localTime}-${index}`} className="rounded-3xl border border-slate-700 bg-slate-900/90 p-4">
                <summary className="cursor-pointer font-medium text-slate-100">
                  {resultItem.localDate} · {resultItem.localTime} · {resultItem.score.toFixed(3)}°
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Object</p>
                    <p className="text-sm text-slate-300">{input.object}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Object azimuth</p>
                    <p className="text-lg font-semibold text-white">{resultItem.object.azimuth.toFixed(3)}°</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Object altitude</p>
                    <p className="text-lg font-semibold text-white">{resultItem.object.altitude.toFixed(3)}°</p>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Target bearing</p>
                    <p className="text-lg font-semibold text-white">{resultItem.target.bearing.toFixed(3)}°</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Target altitude</p>
                    <p className="text-lg font-semibold text-white">{resultItem.target.altitude.toFixed(3)}°</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Distance</p>
                    <p className="text-lg font-semibold text-white">{resultItem.target.distanceKm.toFixed(2)} km</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Angular separation</p>
                    <p className="text-lg font-semibold text-white">{resultItem.alignment.angularSeparation.toFixed(3)}°</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Azimuth difference</p>
                    <p className="text-lg font-semibold text-white">{resultItem.alignment.azimuthDelta.toFixed(3)}°</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Altitude difference</p>
                    <p className="text-lg font-semibold text-white">{resultItem.alignment.altitudeDelta.toFixed(3)}°</p>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alignment quality</p>
                    <p className="text-lg font-semibold text-white">{getAlignmentStars(resultItem.score)} {getAlignmentQuality(resultItem.score)}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Timezone</p>
                    <p className="text-sm text-slate-300">{resultItem.timeZoneLabel}</p>
                    {resultItem.belowHorizon && (
                      <p className="text-sm text-amber-300">Below horizon</p>
                    )}
                    {resultItem.moonIlluminationPercent !== undefined && (
                      <p className="text-sm text-slate-300">Moon illumination: {resultItem.moonIlluminationPercent}%</p>
                    )}
                    {resultItem.moonDistanceKm !== undefined && (
                      <p className="text-sm text-slate-300">Moon distance: {resultItem.moonDistanceKm.toFixed(0)} km</p>
                    )}
                    {resultItem.sunDistanceKm !== undefined && (
                      <p className="text-sm text-slate-300">Sun-Earth distance: {resultItem.sunDistanceKm.toFixed(0)} km</p>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
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
