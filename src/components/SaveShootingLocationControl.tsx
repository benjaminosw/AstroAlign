'use client';

import { useMemo } from 'react';
import type { ShootingArea } from '../lib/opportunities/types';
import { useSavedLocations } from '../lib/saved/savedState';
import { generatedLocationName, geometryKey, shootingAreaToGeometry } from '../lib/saved/types';

interface SaveShootingLocationControlProps {
  area: ShootingArea;
}

const buttonClass =
  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-70';

export default function SaveShootingLocationControl({ area }: SaveShootingLocationControlProps) {
  const { shootingLocations, addShootingLocation, updateShootingLocation, findShootingLocationByGeometryKey, boundShootingLocationId, bindShootingLocation } =
    useSavedLocations();

  const geometry = useMemo(() => shootingAreaToGeometry(area), [area]);
  const key = useMemo(() => geometryKey(geometry), [geometry]);

  const boundLocation = boundShootingLocationId
    ? (shootingLocations.find((item) => item.id === boundShootingLocationId) ?? null)
    : null;
  const geometryMatch = findShootingLocationByGeometryKey(key);
  const dirty = boundLocation !== null && geometryKey(boundLocation.geometry) !== key;

  function handleSave() {
    if (dirty && boundLocation) {
      if (geometryMatch && geometryMatch.id !== boundLocation.id) {
        const proceed = window.confirm(
          `Another saved shooting location "${geometryMatch.name}" already matches this geometry. Update "${boundLocation.name}" anyway?`
        );
        if (!proceed) {
          return;
        }
      }
      updateShootingLocation(boundLocation.id, { geometry });
      return;
    }
    if (boundLocation || geometryMatch) {
      return;
    }
    const created = addShootingLocation({ name: generatedLocationName(geometry), geometry });
    bindShootingLocation(created.id);
  }

  if (dirty) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleSave}
          data-testid="save-shooting-location-changes"
          className={`${buttonClass} border-amber-600 bg-amber-950/60 text-amber-200 hover:border-amber-500 hover:text-amber-100`}
        >
          Save changes
        </button>
        <p data-testid="saved-location-dirty" className="text-xs text-amber-300">
          Unsaved changes to saved shooting location
        </p>
      </div>
    );
  }

  const eff = boundLocation ?? geometryMatch;

  if (eff) {
    return (
      <button
        type="button"
        disabled
        data-testid="saved-shooting-location-button"
        title="Saved to Saved locations"
        className={`${buttonClass} border-emerald-700 bg-emerald-950/50 text-emerald-200`}
      >
        Saved ✓ {eff.name}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      data-testid="save-shooting-location-button"
      className={`${buttonClass} border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white`}
    >
      Save shooting location
    </button>
  );
}
