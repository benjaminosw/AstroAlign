'use client';

import { useEffect, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import LocationEditor from './LocationEditor';
import LandmarkSearch from './LandmarkSearch';

interface LocationControlsProps {
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
}

function noop() {}

export default function LocationControls({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  onObserverChange,
  onTargetChange,
  landmark = null,
  onSelectLandmark = noop,
  onClearLandmark = noop,
  onInputErrorChange = noop
}: LocationControlsProps) {
  const [observerError, setObserverError] = useState(false);
  const [targetError, setTargetError] = useState(false);

  const hasInputError = observerError || targetError;

  useEffect(() => {
    onInputErrorChange(hasInputError);
  }, [hasInputError, onInputErrorChange]);

  const localNow = timeZone ? getLocalDateTimeForTimeZone(timeZone) : null;
  const formattedTimezone = timeZone && localNow ? formatTimezoneLabel(localNow.date, localNow.time, timeZone) : null;

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
    <section data-testid="location-controls" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Location</h2>
        {timezoneStatusNode}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LocationEditor
          idPrefix="observer"
          title="Observer location"
          icon="camera"
          values={observer}
          onChange={onObserverChange}
          onErrorChange={setObserverError}
        />
        <LocationEditor
          idPrefix="target"
          title="Target location"
          icon="target"
          values={target}
          onChange={onTargetChange}
          onErrorChange={setTargetError}
        />
      </div>

      <div className="w-full">
        <LandmarkSearch ariaLabel="Search landmark" onSelect={onSelectLandmark} />
      </div>

      {landmark && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span aria-hidden="true">🎯</span>
            <p className="truncate text-sm font-medium text-white">{landmark.name}</p>
            {landmarkSubtitle && <p className="truncate text-xs text-slate-400">{landmarkSubtitle}</p>}
            {coordinatesAdjusted && <p className="text-xs font-medium text-amber-300">Coordinates manually adjusted</p>}
          </div>
          <button
            type="button"
            aria-label="Clear landmark"
            title="Clear landmark"
            onClick={onClearLandmark}
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {hasInputError && (
        <p className="text-sm text-rose-300" role="alert">
          Enter valid coordinates to continue.
        </p>
      )}
    </section>
  );
}
