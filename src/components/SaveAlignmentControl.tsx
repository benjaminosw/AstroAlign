'use client';

import { useState } from 'react';
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

export function buildSaveAlignmentInput(props: SaveAlignmentControlProps): SaveAlignmentInput {
  return {
    source: props.source,
    object: props.object,
    event: props.event,
    date: props.date,
    time: props.time,
    timeZone: props.timeZone ?? null,
    celestialAzimuth: props.celestialAzimuth,
    targetBearing: props.targetBearing,
    alignmentError: props.alignmentError,
    toleranceDegrees: props.toleranceDegrees ?? null,
    withinTolerance: props.withinTolerance ?? null,
    moonPhase: props.moonPhase ?? null,
    targetId: props.targetId ?? null,
    shootingSetupId: props.shootingSetupId ?? null,
    observerSnapshot: props.observer
      ? { latitude: props.observer.latitude, longitude: props.observer.longitude, elevation: props.observer.elevation }
      : null,
    targetSnapshot: props.target
      ? { latitude: props.target.latitude, longitude: props.target.longitude, elevation: props.target.elevation }
      : null,
    shootingPositionSnapshot: props.shootingPosition ?? null,
    shootingLocationSnapshot: props.shootingLocationSnapshot ?? null
  };
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
  const [justSaved, setJustSaved] = useState(false);

  const dedupeKey = savedAlignmentDedupeKey({ source, object, event, date, time, celestialAzimuth });
  const existing = findSavedAlignmentByDedupeKey(dedupeKey);
  const alreadySaved = existing !== null || justSaved;

  function handleSave() {
    addSavedAlignment(buildSaveAlignmentInput({
      source,
      object,
      event,
      date,
      time,
      timeZone,
      celestialAzimuth,
      targetBearing,
      alignmentError,
      toleranceDegrees,
      withinTolerance,
      moonPhase,
      targetId,
      shootingSetupId,
      observer,
      target,
      shootingPosition,
      shootingLocationSnapshot
    }));
    setJustSaved(true);
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
