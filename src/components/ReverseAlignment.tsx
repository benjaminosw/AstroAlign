'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AstroObject, GeographicPoint } from '../types/astronomy';
import { ASTRO_OBJECT } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import type { RiseSetType } from '../lib/astronomy/riseSet';
import { calculateReverseAlignment } from '../lib/alignment/reverseAlignment';
import type { ReverseAlignmentResult } from '../lib/alignment/reverseAlignment';
import { getMoonPhase } from '../lib/astronomy/lunarPhase';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatResultDate } from '../lib/utils/formatResultDate';
import LandmarkSearch from './LandmarkSearch';
import LocationEditor from './LocationEditor';
import { PlaceSummary } from './LocationControls';
import { usePersistedState } from '../lib/storage/appState';

const AUTO_CALC_DEBOUNCE_MS = 200;

const ReverseAlignmentMap = dynamic(() => import('./ReverseAlignmentMap'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="reverse-alignment-map-loading"
      className="h-[380px] w-full rounded-2xl border border-slate-800 bg-slate-900 lg:h-[520px]"
    />
  )
});

const OBJECT_SYMBOL: Record<AstroObject, string> = {
  Sun: '☀',
  Moon: '🌙'
};

function ChevronLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

interface ReverseAlignmentProps {
  target: GeographicPoint;
  landmark?: SelectedLandmark | null;
  targetCoordinateError: string | null;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
}

function eventLabel(object: AstroObject, eventType: RiseSetType): string {
  return `${object}${eventType === 'rise' ? 'rise' : 'set'}`;
}

export default function ReverseAlignment({
  target,
  landmark = null,
  targetCoordinateError,
  timeZone,
  timeZoneStatus,
  onTargetChange,
  onSelectLandmark = () => {},
  onClearLandmark = () => {}
}: ReverseAlignmentProps) {
  const [object, setObject] = usePersistedState<AstroObject>('reverse.object', ASTRO_OBJECT.Sun);
  const [eventType, setEventType] = usePersistedState<RiseSetType>('reverse.eventType', 'rise');
  const [date, setDate] = usePersistedState<string | null>('reverse.date', null);
  const [snapshot, setSnapshot] = useState<ReverseAlignmentResult | null>(null);
  const [locationInputError, setLocationInputError] = useState(false);
  const [flyToId, setFlyToId] = useState(0);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  const autoCalcTimerRef = useRef<number | null>(null);
  const autoCalcVersionRef = useRef(0);

  useEffect(() => {
    if (date !== null || !timeZone) {
      return;
    }
    setDate(getLocalDateTimeForTimeZone(timeZone).date);
  }, [timeZone, date, setDate]);

  useEffect(() => {
    if (timeZoneStatus === 'loading' || !timeZone || !date || locationInputError || targetCoordinateError) {
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
        const result = calculateReverseAlignment({ object, eventType, date, timeZone, target });
        if (!result) {
          setAutoError(
            `No ${eventLabel(object, eventType)} occurs at the target location on ${formatResultDate(date)}. Pick another date or event.`
          );
        } else {
          setSnapshot(result);
          setAutoError(null);
        }
      } catch {
        setAutoError('Unable to calculate the reverse alignment. Check the inputs and try again.');
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
  }, [object, eventType, date, timeZone, timeZoneStatus, locationInputError, targetCoordinateError, target]);

  function shiftDate(isoDate: string, deltaDays: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
  }

  function goToPreviousDay() {
    if (date) {
      setDate(shiftDate(date, -1));
    }
  }

  function goToNextDay() {
    if (date) {
      setDate(shiftDate(date, 1));
    }
  }

  function handleSelectLandmark(selected: SelectedLandmark) {
    onSelectLandmark(selected);
    setFlyToId((id) => id + 1);
  }

  function handleTargetMove(latitude: number, longitude: number) {
    onTargetChange('latitude', String(latitude));
    onTargetChange('longitude', String(longitude));
  }

  const moonPhase =
    snapshot && snapshot.object === ASTRO_OBJECT.Moon ? getMoonPhase(new Date(snapshot.utcInstant)) : null;

  const coordinatesAdjusted =
    landmark !== null && (target.latitude !== landmark.latitude || target.longitude !== landmark.longitude);

  return (
    <div data-testid="reverse-alignment-workspace" className="space-y-6">
      <p className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-slate-300">
        This gives a direction, not a unique shooting location. Any observer located along the{' '}
        <span className="font-semibold text-emerald-300">Target → Possible observer</span> bearing could potentially
        produce this alignment, subject to terrain, visibility and the actual shooting location.
      </p>

      <section data-testid="reverse-location-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Location</h2>
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

        <div className="mt-4">
          <LocationEditor
            idPrefix="reverse-target"
            title="Target location"
            icon="target"
            values={target}
            onChange={onTargetChange}
            onErrorChange={setLocationInputError}
            searchNode={<LandmarkSearch onSelect={handleSelectLandmark} ariaLabel="Landmark" />}
            summaryNode={
              landmark ? (
                <PlaceSummary
                  place={landmark}
                  coordinatesAdjusted={coordinatesAdjusted}
                  clearLabel="Clear landmark"
                  onClear={onClearLandmark}
                  icon="🎯"
                />
              ) : null
            }
          />
        </div>

        {(locationInputError || targetCoordinateError) && (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {targetCoordinateError ?? 'Enter valid target coordinates to continue.'}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Rise/set events are calculated for the target location. No observer location is needed.
        </p>
      </section>

      <ReverseAlignmentMap
        target={target}
        targetName={landmark?.name ?? null}
        onTargetMove={handleTargetMove}
        overlay={
          snapshot
            ? {
                object: snapshot.object,
                objectAzimuth: snapshot.objectAzimuth,
                shootingBearing: snapshot.shootingBearing,
                observerDirectionFromTarget: snapshot.observerDirectionFromTarget
              }
            : null
        }
        flyToId={flyToId}
        className="h-[380px] lg:h-[520px]"
      />

      <div data-testid="reverse-columns" className="grid items-start gap-6 lg:grid-cols-2">
        <section data-testid="reverse-settings-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Alignment settings</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reverse-object" className="text-sm text-slate-300">
                Object
              </label>
              <select
                id="reverse-object"
                value={object}
                onChange={(event) => setObject(event.target.value as AstroObject)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value={ASTRO_OBJECT.Sun}>Sun</option>
                <option value={ASTRO_OBJECT.Moon}>Moon</option>
              </select>
            </div>

            <div>
              <label htmlFor="reverse-event" className="text-sm text-slate-300">
                Event
              </label>
              <select
                id="reverse-event"
                value={eventType}
                onChange={(event) => setEventType(event.target.value as RiseSetType)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="rise">{eventLabel(object, 'rise')}</option>
                <option value="set">{eventLabel(object, 'set')}</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="reverse-date" className="text-sm text-slate-300">
              Date
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousDay}
                aria-label="Previous day"
                title="Previous day"
                className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <ChevronLeft />
              </button>
              <input
                id="reverse-date"
                type="date"
                value={date ?? ''}
                onChange={(event) => setDate(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={goToNextDay}
                aria-label="Next day"
                title="Next day"
                className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </section>

        <section data-testid="reverse-result-card" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Reverse alignment result</h2>

          {autoUpdating && (
            <div
              role="status"
              data-testid="reverse-auto-updating"
              className="mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300"
            >
              Updating reverse alignment…
            </div>
          )}

          {autoError && (
            <div
              role="status"
              data-testid="reverse-auto-error"
              className="mt-3 rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200"
            >
              ⚠ Unable to update — {autoError}
              {snapshot ? ' Previous result shown below.' : ''}
            </div>
          )}

          {snapshot ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  {OBJECT_SYMBOL[snapshot.object]} {eventLabel(snapshot.object, snapshot.eventType)}
                </p>
                <p className="mt-0.5 text-sm text-slate-400">
                  {formatResultDate(snapshot.date)} · {snapshot.time} ({snapshot.timeZoneLabel})
                </p>
              </div>

              {moonPhase && (
                <p data-testid="reverse-moon-phase" className="text-sm text-slate-300">
                  <span aria-hidden="true">{moonPhase.emoji}</span> Moon phase:{' '}
                  <span className="font-semibold text-white">{moonPhase.name}</span>
                  <span className="text-slate-400"> · {moonPhase.illuminationPercent.toFixed(0)}% illuminated</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Observer → Target</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{snapshot.shootingBearing.toFixed(2)}°</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Target → Possible observer</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {snapshot.observerDirectionFromTarget.toFixed(2)}°
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Results will appear here automatically based on the target, object and date. The result tells you the
              direction from the target where an observer could have stood — not an exact shooting spot.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
