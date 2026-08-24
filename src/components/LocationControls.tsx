'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import type { ShootingArea } from '../lib/opportunities/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import LocationEditor from './LocationEditor';
import LocationSearch from './LocationSearch';
import SaveTargetControl from './SaveTargetControl';
import SaveShootingLocationControl from './SaveShootingLocationControl';
import SaveSetupControl from './SaveSetupControl';

interface LocationControlsProps {
  observer: GeographicPoint;
  target: GeographicPoint;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  observerLandmark?: SelectedLandmark | null;
  landmark?: SelectedLandmark | null;
  onSelectObserverLandmark?: (_landmark: SelectedLandmark) => void;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearObserverLandmark?: () => void;
  onClearLandmark?: () => void;
  onInputErrorChange?: (_hasError: boolean) => void;
  onGoToSavedLocations?: () => void;
}

function noop() {}

interface PlaceSummaryProps {
  place: SelectedLandmark;
  coordinatesAdjusted: boolean;
  clearLabel: string;
  onClear: () => void;
  icon: string;
}

export function PlaceSummary({ place, coordinatesAdjusted, clearLabel, onClear, icon }: PlaceSummaryProps) {
  const subtitle = place.formattedAddress ?? ([place.locality, place.country].filter(Boolean).join(', ') || null);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden="true" className="mt-0.5 text-xs">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{place.name}</p>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
          {coordinatesAdjusted && (
            <p className="mt-0.5 text-[11px] font-medium text-amber-300">Coordinates manually adjusted</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        title="Clear selection"
        className="rounded-lg px-2 py-0.5 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

export default function LocationControls({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  onObserverChange,
  onTargetChange,
  observerLandmark = null,
  landmark = null,
  onSelectObserverLandmark = noop,
  onSelectLandmark = noop,
  onClearObserverLandmark = noop,
  onClearLandmark = noop,
  onInputErrorChange = noop,
  onGoToSavedLocations = noop
}: LocationControlsProps) {
  const [observerError, setObserverError] = useState(false);
  const [targetError, setTargetError] = useState(false);

  const hasInputError = observerError || targetError;

  const observerArea = useMemo<ShootingArea>(
    () => ({
      type: 'points',
      points: [
        {
          id: 'observer',
          name: observerLandmark?.name ?? 'Observer',
          latitude: observer.latitude,
          longitude: observer.longitude
        }
      ]
    }),
    [observerLandmark, observer.latitude, observer.longitude]
  );

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

  const observerCoordinatesAdjusted =
    observerLandmark !== null &&
    (observer.latitude !== observerLandmark.latitude || observer.longitude !== observerLandmark.longitude);
  const targetCoordinatesAdjusted =
    landmark !== null && (target.latitude !== landmark.latitude || target.longitude !== landmark.longitude);

  return (
    <section data-testid="location-controls" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Location</h2>
        {timezoneStatusNode}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <LocationEditor
            idPrefix="observer"
            title="Observer location"
            icon="camera"
            values={observer}
            onChange={onObserverChange}
            onErrorChange={setObserverError}
            searchNode={
              <LocationSearch
                idPrefix="observer"
                ariaLabel="Observer location"
                placeholder="Search for an address, postal code or place..."
                onSelect={onSelectObserverLandmark}
              />
            }
            summaryNode={
              observerLandmark ? (
                <PlaceSummary
                  place={observerLandmark}
                  coordinatesAdjusted={observerCoordinatesAdjusted}
                  clearLabel="Clear observer landmark"
                  onClear={onClearObserverLandmark}
                  icon="📷"
                />
              ) : null
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SaveShootingLocationControl area={observerArea} />
            <SaveSetupControl
              target={target}
              landmarkName={landmark?.name ?? null}
              area={observerArea}
              onGoToSavedLocations={onGoToSavedLocations}
            />
          </div>
        </div>
        <div className="min-w-0">
          <LocationEditor
            idPrefix="target"
            title="Target location"
            icon="target"
            values={target}
            onChange={onTargetChange}
            onErrorChange={setTargetError}
            searchNode={
              <LocationSearch
                idPrefix="target"
                ariaLabel="Target location"
                placeholder="Search for a landmark or address..."
                onSelect={onSelectLandmark}
              />
            }
            summaryNode={
              landmark ? (
                <PlaceSummary
                  place={landmark}
                  coordinatesAdjusted={targetCoordinatesAdjusted}
                  clearLabel="Clear landmark"
                  onClear={onClearLandmark}
                  icon="🎯"
                />
              ) : null
            }
          />
          <div className="mt-3 flex justify-end">
            <SaveTargetControl target={target} landmarkName={landmark?.name ?? null} />
          </div>
        </div>
      </div>

      {hasInputError && (
        <p className="text-sm text-rose-300" role="alert">
          Enter valid coordinates to continue.
        </p>
      )}
    </section>
  );
}
