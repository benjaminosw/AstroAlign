'use client';

import { useMemo, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { ShootingArea } from '../lib/opportunities/types';
import { useSavedLocations } from '../lib/saved/savedState';
import {
  coordinateKey,
  generatedLocationName,
  generatedTargetName,
  geometryKey,
  sameCoordinates,
  shootingAreaToGeometry
} from '../lib/saved/types';

interface SaveSetupControlProps {
  target: GeographicPoint;
  landmarkName: string | null;
  area: ShootingArea;
  onGoToSavedLocations?: () => void;
}

const buttonClass =
  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-70';

export default function SaveSetupControl({
  target,
  landmarkName,
  area,
  onGoToSavedLocations = () => {}
}: SaveSetupControlProps) {
  const {
    targets,
    shootingLocations,
    addTarget,
    updateTarget,
    addShootingLocation,
    updateShootingLocation,
    addSetup,
    findTargetByCoordinates,
    findShootingLocationByGeometryKey,
    boundTargetId,
    boundShootingLocationId,
    bindTarget,
    bindShootingLocation
  } = useSavedLocations();

  const geometry = useMemo(() => shootingAreaToGeometry(area), [area]);
  const key = useMemo(() => geometryKey(geometry), [geometry]);
  const currentKey = `${coordinateKey(target.latitude, target.longitude)}|${key}`;

  const [savedSetup, setSavedSetup] = useState<{ name: string; key: string } | null>(null);
  const alreadySaved = savedSetup !== null && savedSetup.key === currentKey;

  const boundTarget = boundTargetId ? (targets.find((item) => item.id === boundTargetId) ?? null) : null;
  const boundLocation = boundShootingLocationId
    ? (shootingLocations.find((item) => item.id === boundShootingLocationId) ?? null)
    : null;

  function handleSave() {
    const coordsMatchTarget = findTargetByCoordinates(target.latitude, target.longitude);
    const locationMatch = findShootingLocationByGeometryKey(key);

    let targetId = (boundTarget ?? coordsMatchTarget)?.id;
    if (!targetId) {
      const created = addTarget({
        name: landmarkName ?? generatedTargetName(target),
        latitude: target.latitude,
        longitude: target.longitude
      });
      bindTarget(created.id);
      targetId = created.id;
    } else if (boundTarget && !sameCoordinates(boundTarget, target)) {
      updateTarget(boundTarget.id, { latitude: target.latitude, longitude: target.longitude });
    }

    let locationId = (boundLocation ?? locationMatch)?.id;
    if (!locationId) {
      const created = addShootingLocation({ name: generatedLocationName(geometry), geometry });
      bindShootingLocation(created.id);
      locationId = created.id;
    } else if (boundLocation && geometryKey(boundLocation.geometry) !== key) {
      updateShootingLocation(boundLocation.id, { geometry });
    }

    const targetName = targets.find((item) => item.id === targetId)?.name ?? landmarkName ?? generatedTargetName(target);
    const locationName =
      shootingLocations.find((item) => item.id === locationId)?.name ?? generatedLocationName(geometry);
    const setup = addSetup({
      name: `${targetName} · ${locationName}`,
      targetId: targetId!,
      shootingLocationId: locationId!
    });
    setSavedSetup({ name: setup.name, key: currentKey });
  }

  if (alreadySaved) {
    return (
      <div className="flex flex-col gap-1">
        <span data-testid="saved-setup-button" className={`${buttonClass} border-emerald-700 bg-emerald-950/50 text-emerald-200`}>
          Setup saved ✓ {savedSetup!.name}
        </span>
        <button
          type="button"
          onClick={onGoToSavedLocations}
          data-testid="view-saved-locations"
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          View in Saved locations
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      data-testid="save-setup-button"
      className={`${buttonClass} border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white`}
    >
      Save as setup
    </button>
  );
}
