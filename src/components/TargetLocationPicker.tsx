'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { SelectedLandmark } from '../lib/geocoding/types';
import LandmarkSearch from './LandmarkSearch';
import NumberField from './NumberField';

const TargetSelectionMap = dynamic(() => import('./TargetSelectionMap'), {
  ssr: false,
  loading: () => (
    <div data-testid="target-map-loading" className="h-[300px] w-full rounded-2xl border border-slate-800 bg-slate-900" />
  )
});

interface TargetLocationPickerProps {
  idPrefix?: string;
  target: { latitude: number; longitude: number; elevation?: number };
  landmark: SelectedLandmark | null;
  onTargetChange: (_field: 'latitude' | 'longitude' | 'elevation', _value: string) => void;
  onSelectLandmark: (_landmark: SelectedLandmark) => void;
  onClearLandmark: () => void;
}

export default function TargetLocationPicker({
  idPrefix = 'target',
  target,
  landmark,
  onTargetChange,
  onSelectLandmark,
  onClearLandmark
}: TargetLocationPickerProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [flyToId, setFlyToId] = useState(0);

  const coordinatesAdjusted =
    landmark !== null &&
    (target.latitude !== landmark.latitude || target.longitude !== landmark.longitude);

  const landmarkSubtitle = landmark ? [landmark.locality, landmark.country].filter(Boolean).join(', ') : '';

  function handleSelectLandmark(result: SelectedLandmark) {
    onSelectLandmark(result);
    setFlyToId((id) => id + 1);
  }

  function handleMapMove(latitude: number, longitude: number) {
    onTargetChange('latitude', String(latitude));
    onTargetChange('longitude', String(longitude));
  }

  const mapButtonLabel = mapOpen ? 'Hide map' : landmark ? 'Adjust on map' : 'Select target on map';

  return (
    <div className="space-y-4">
      <LandmarkSearch onSelect={handleSelectLandmark} ariaLabel="Landmark" />

      {landmark && (
        <div className="flex items-start justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <span aria-hidden="true" className="mt-0.5">
              📍
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

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
        or manually enter coordinates
        <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
      </div>

      <NumberField
        id={`${idPrefix}-latitude`}
        label="Latitude"
        fieldValue={String(target.latitude)}
        onChange={(value) => onTargetChange('latitude', value)}
      />
      <NumberField
        id={`${idPrefix}-longitude`}
        label="Longitude"
        fieldValue={String(target.longitude)}
        onChange={(value) => onTargetChange('longitude', value)}
      />
      {target.elevation !== undefined && (
        <NumberField
          id={`${idPrefix}-elevation`}
          label="Elevation (m)"
          fieldValue={String(target.elevation)}
          onChange={(value) => onTargetChange('elevation', value)}
        />
      )}

      <button
        type="button"
        onClick={() => setMapOpen((open) => !open)}
        aria-expanded={mapOpen}
        data-testid="toggle-target-map"
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        {mapOpen ? '− Hide map' : mapButtonLabel}
      </button>

      {mapOpen && (
        <TargetSelectionMap
          latitude={target.latitude}
          longitude={target.longitude}
          landmarkName={landmark?.name ?? null}
          onMove={handleMapMove}
          flyToId={flyToId}
        />
      )}
    </div>
  );
}
