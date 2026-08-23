'use client';

import type { AstroObject, GeographicPoint } from '../types/astronomy';
import type { MoonPhaseInfo } from '../lib/astronomy/lunarPhase';
import { useSavedLocations } from '../lib/saved/savedState';
import { savedAlignmentDedupeKey } from '../lib/saved/types';
import type {
  SavedAlignmentShootingLocationSnapshot,
  SavedAlignmentShootingPositionSnapshot,
  SavedAlignmentSource,
  SaveAlignmentInput
} from '../lib/saved/types';

export interface SaveAlignmentControlProps {
  source: SavedAlignmentSource;
  object: AstroObject;
  event: 'rise' | 'set' | null;
  date: string;
  time: string;
  timeZone?: string | null;
  celestialAzimuth: number;
  targetBearing: number;
  alignmentError: number;
  toleranceDegrees?: number | null;
  withinTolerance?: boolean | null;
  moonPhase?: MoonPhaseInfo | null;
  targetId?: string | null;
  shootingSetupId?: string | null;
  observer?: GeographicPoint | null;
  target?: GeographicPoint | null;
  shootingPosition?: SavedAlignmentShootingPositionSnapshot | null;
  shootingLocationSnapshot?: SavedAlignmentShootingLocationSnapshot | null;
}

export default function SaveAlignmentControl({
  source,
  object,
  event,
  date,
  time,
  timeZone = null,
  celestialAzimuth,
  targetBearing,
  alignmentError,
  toleranceDegrees = null,
  withinTolerance = null,
  moonPhase = null,
  targetId = null,
  shootingSetupId = null,
  observer = null,
  target = null,
  shootingPosition = null,
  shootingLocationSnapshot = null
}: SaveAlignmentControlProps) {
  const { addSavedAlignment, findSavedAlignmentByDedupeKey } = useSavedLocations();

  const dedupeKey = savedAlignmentDedupeKey({ source, object, event, date, time, celestialAzimuth });
  const alreadySaved = findSavedAlignmentByDedupeKey(dedupeKey) !== null;

  function handleSave() {
    const input: SaveAlignmentInput = {
      source,
      object,
      event,
      date,
      time,
      timeZone: timeZone ?? null,
      celestialAzimuth,
      targetBearing,
      alignmentError,
      toleranceDegrees: toleranceDegrees ?? null,
      withinTolerance: withinTolerance ?? null,
      moonPhase: moonPhase ?? null,
      targetId: targetId ?? null,
      shootingSetupId: shootingSetupId ?? null,
      observerSnapshot: observer
        ? { latitude: observer.latitude, longitude: observer.longitude, elevation: observer.elevation }
        : null,
      targetSnapshot: target
        ? { latitude: target.latitude, longitude: target.longitude, elevation: target.elevation }
        : null,
      shootingPositionSnapshot: shootingPosition ?? null,
      shootingLocationSnapshot: shootingLocationSnapshot ?? null
    };
    addSavedAlignment(input);
  }

  return (
    <button
      type="button"
      data-testid="save-alignment-button"
      onClick={handleSave}
      disabled={alreadySaved}
      className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${
        alreadySaved
          ? 'cursor-default bg-emerald-500/15 text-emerald-300'
          : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {alreadySaved ? 'Saved ✓' : 'Save alignment'}
    </button>
  );
}
