'use client';

import type { ReactNode } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import NumberField from './NumberField';
import TargetLocationPicker from './TargetLocationPicker';

interface LocationInputsProps {
  observer: GeographicPoint;
  target: GeographicPoint;
  timeZone: string | null;
  timeZoneStatus: 'idle' | 'loading' | 'error';
  observerCoordinateError: string | null;
  onObserverChange: (_field: keyof GeographicPoint, _value: string) => void;
  onTargetChange: (_field: keyof GeographicPoint, _value: string) => void;
  landmark?: SelectedLandmark | null;
  onSelectLandmark?: (_landmark: SelectedLandmark) => void;
  onClearLandmark?: () => void;
}

function noop() {}

function LocationSection({
  title,
  children,
  status
}: {
  title: string;
  children: ReactNode;
  status?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {status}
      </div>
      {children}
    </section>
  );
}

export default function LocationInputs({
  observer,
  target,
  timeZone,
  timeZoneStatus,
  observerCoordinateError,
  onObserverChange,
  onTargetChange,
  landmark = null,
  onSelectLandmark = noop,
  onClearLandmark = noop
}: LocationInputsProps) {
  const localNow = timeZone ? getLocalDateTimeForTimeZone(timeZone) : null;
  const formattedTimezone = timeZone && localNow ? formatTimezoneLabel(localNow.date, localNow.time, timeZone) : null;

  const observerStatus = observerCoordinateError ? (
    <span className="text-xs text-rose-300">{observerCoordinateError}</span>
  ) : timeZoneStatus === 'loading' ? (
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

  return (
    <div className="space-y-6">
      <LocationSection title="Observer" status={observerStatus}>
        <NumberField
          id="observer-latitude"
          label="Latitude"
          fieldValue={String(observer.latitude)}
          onChange={(value) => onObserverChange('latitude', value)}
        />
        <NumberField
          id="observer-longitude"
          label="Longitude"
          fieldValue={String(observer.longitude)}
          onChange={(value) => onObserverChange('longitude', value)}
        />
        <NumberField
          id="observer-elevation"
          label="Elevation (m)"
          fieldValue={String(observer.elevation)}
          onChange={(value) => onObserverChange('elevation', value)}
        />
      </LocationSection>

      <LocationSection title="Target">
        <TargetLocationPicker
          idPrefix="target"
          target={target}
          landmark={landmark}
          onTargetChange={onTargetChange}
          onSelectLandmark={onSelectLandmark}
          onClearLandmark={onClearLandmark}
        />
      </LocationSection>
    </div>
  );
}
