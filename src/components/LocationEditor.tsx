'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import CoordinateField from './CoordinateField';
import LandmarkSearch from './LandmarkSearch';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div data-testid="location-map-loading" className="h-[340px] w-full rounded-2xl border border-slate-800 bg-slate-900" />
  )
});

type EditingLocation = 'observer' | 'target';

interface LocationEditorProps {
  observer: GeographicPoint;
  target: GeographicPoint;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  landmark?: SelectedLandmark | null;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
  onInputErrorChange?: (_hasError: boolean) => void;
  actions?: ReactNode;
}

function noop() {}

export default function LocationEditor({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  onObserverChange,
  onTargetChange,
  landmark = null,
  onSelectLandmark = noop,
  onClearLandmark = noop,
  onInputErrorChange = noop,
  actions
}: LocationEditorProps) {
  const [editing, setEditing] = useState<EditingLocation>('observer');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mapFitId, setMapFitId] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({
    observerLatitude: false,
    observerLongitude: false,
    targetLatitude: false,
    targetLongitude: false
  });
  const firstRenderRef = useRef(true);

  const hasInputError = Object.values(fieldErrors).some((hasError) => hasError);

  useEffect(() => {
    onInputErrorChange(hasInputError);
  }, [hasInputError, onInputErrorChange]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setMapFitId((id) => id + 1);
  }, [observer.latitude, observer.longitude, target.latitude, target.longitude]);

  const localNow = timeZone ? getLocalDateTimeForTimeZone(timeZone) : null;
  const formattedTimezone = timeZone && localNow ? formatTimezoneLabel(localNow.date, localNow.time, timeZone) : null;

  function setFieldError(field: keyof typeof fieldErrors, hasError: boolean) {
    setFieldErrors((prev) => ({ ...prev, [field]: hasError }));
  }

  function handleObserverMove(latitude: number, longitude: number) {
    setHasInteracted(true);
    onObserverChange('latitude', String(latitude));
    onObserverChange('longitude', String(longitude));
  }

  function handleTargetMove(latitude: number, longitude: number) {
    setHasInteracted(true);
    onTargetChange('latitude', String(latitude));
    onTargetChange('longitude', String(longitude));
  }

  function handleActivate(location: EditingLocation) {
    setHasInteracted(true);
    setEditing(location);
  }

  function handleSelectLandmark(selected: SelectedLandmark) {
    setHasInteracted(true);
    onSelectLandmark(selected);
  }

  const selectedPoint = editing === 'observer' ? observer : target;
  const selectedLabel = editing === 'observer' ? 'Observer' : 'Target';

  const timezoneStatusNode =
    timeZoneStatus === 'loading' ? (
      <span className="text-xs text-slate-400">Detecting timezone…</span>
    ) : timeZoneStatus === 'error' ? (
      <span className="text-xs text-rose-300">Timezone unavailable</span>
    ) : formattedTimezone ? (
      <span
        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200"
        title="Automatically detected from observer location"
      >
        {formattedTimezone}
      </span>
    ) : (
      <span className="text-xs text-slate-500">Enter valid coordinates to detect timezone</span>
    );

  const landmarkSubtitle = landmark ? [landmark.locality, landmark.country].filter(Boolean).join(', ') : '';
  const coordinatesAdjusted =
    landmark !== null && (target.latitude !== landmark.latitude || target.longitude !== landmark.longitude);

  return (
    <section data-testid="location-editor" className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Location</h2>
        {timezoneStatusNode}
      </div>

      <LocationMap
        observer={observer}
        target={target}
        observerName={null}
        targetName={landmark?.name ?? null}
        activeLocation={editing}
        onObserverMove={handleObserverMove}
        onTargetMove={handleTargetMove}
        onActivate={handleActivate}
        fitId={mapFitId}
      />

      {!hasInteracted && (
        <p data-testid="location-hint" className="text-xs text-slate-400">
          Click or drag the map marker to reposition the selected location.
        </p>
      )}

      <div
        role="group"
        aria-label="Edit location"
        className="inline-flex rounded-2xl border border-slate-800 bg-slate-900 p-1"
      >
        <button
          type="button"
          role="button"
          data-testid="editing-observer"
          aria-pressed={editing === 'observer'}
          onClick={() => setEditing('observer')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            editing === 'observer' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Observer
        </button>
        <button
          type="button"
          role="button"
          data-testid="editing-target"
          aria-pressed={editing === 'target'}
          onClick={() => setEditing('target')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            editing === 'target' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Target
        </button>
      </div>

      <div
        data-testid="selected-location-info"
        className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm"
      >
        <p className="font-semibold text-white">Editing: {selectedLabel}</p>
        <p className="mt-0.5 text-xs tabular-nums text-slate-400">
          {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)} · Elevation{' '}
          {selectedPoint.elevation.toFixed(1)} m
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-200">Observer location</p>
        <div className="mt-3 space-y-4">
          <CoordinateField
            id="observer-latitude"
            label="Latitude"
            value={observer.latitude}
            min={-90}
            max={90}
            onChange={(value) => onObserverChange('latitude', value)}
            onError={(hasError) => setFieldError('observerLatitude', hasError)}
          />
          <CoordinateField
            id="observer-longitude"
            label="Longitude"
            value={observer.longitude}
            min={-180}
            max={180}
            onChange={(value) => onObserverChange('longitude', value)}
            onError={(hasError) => setFieldError('observerLongitude', hasError)}
          />
          <CoordinateField
            id="observer-elevation"
            label="Elevation (m)"
            value={observer.elevation}
            onChange={(value) => onObserverChange('elevation', value)}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-200">Target location</p>
        <div className="mt-3 space-y-4">
          <LandmarkSearch onSelect={handleSelectLandmark} ariaLabel="Landmark" />

          {landmark && (
            <div className="flex items-start justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden="true" className="mt-0.5">
                  🎯
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{landmark.name}</p>
                  {landmarkSubtitle && <p className="mt-0.5 truncate text-xs text-slate-400">{landmarkSubtitle}</p>}
                  {coordinatesAdjusted && (
                    <p className="mt-1 text-xs font-medium text-amber-300">Coordinates manually adjusted</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClearLandmark}
                aria-label="Clear landmark"
                title="Clear landmark"
                className="rounded-lg px-2 py-0.5 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            </div>
          )}

          <CoordinateField
            id="target-latitude"
            label="Latitude"
            value={target.latitude}
            min={-90}
            max={90}
            onChange={(value) => onTargetChange('latitude', value)}
            onError={(hasError) => setFieldError('targetLatitude', hasError)}
          />
          <CoordinateField
            id="target-longitude"
            label="Longitude"
            value={target.longitude}
            min={-180}
            max={180}
            onChange={(value) => onTargetChange('longitude', value)}
            onError={(hasError) => setFieldError('targetLongitude', hasError)}
          />
          <CoordinateField
            id="target-elevation"
            label="Elevation (m)"
            value={target.elevation}
            onChange={(value) => onTargetChange('elevation', value)}
          />
        </div>
      </div>

      {hasInputError && (
        <p className="text-sm text-rose-300" role="alert">
          Enter valid coordinates to continue.
        </p>
      )}

      {actions && <div>{actions}</div>}
    </section>
  );
}
