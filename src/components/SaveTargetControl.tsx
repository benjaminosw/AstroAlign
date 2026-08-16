'use client';

import type { GeographicPoint } from '../types/astronomy';
import { useSavedLocations } from '../lib/saved/savedState';
import { generatedTargetName, sameCoordinates } from '../lib/saved/types';

interface SaveTargetControlProps {
  target: GeographicPoint;
  landmarkName: string | null;
}

const buttonClass =
  'rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-70';

export default function SaveTargetControl({ target, landmarkName }: SaveTargetControlProps) {
  const { targets, addTarget, updateTarget, findTargetByCoordinates, boundTargetId, bindTarget } =
    useSavedLocations();

  const boundTarget = boundTargetId ? (targets.find((item) => item.id === boundTargetId) ?? null) : null;
  const coordsMatch = findTargetByCoordinates(target.latitude, target.longitude);
  const dirty = boundTarget !== null && !sameCoordinates(boundTarget, target);

  function handleSave() {
    if (dirty && boundTarget) {
      if (coordsMatch && coordsMatch.id !== boundTarget.id) {
        const proceed = window.confirm(
          `Another saved target "${coordsMatch.name}" already exists at these coordinates. Update "${boundTarget.name}" anyway?`
        );
        if (!proceed) {
          return;
        }
      }
      updateTarget(boundTarget.id, { latitude: target.latitude, longitude: target.longitude });
      return;
    }
    if (boundTarget || coordsMatch) {
      return;
    }
    const created = addTarget({
      name: landmarkName ?? generatedTargetName(target),
      latitude: target.latitude,
      longitude: target.longitude
    });
    bindTarget(created.id);
  }

  function handleSaveAsNew() {
    const created = addTarget({
      name: landmarkName ?? generatedTargetName(target),
      latitude: target.latitude,
      longitude: target.longitude
    });
    bindTarget(created.id);
  }

  if (dirty) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          data-testid="save-target-changes"
          className={`${buttonClass} border-amber-600 bg-amber-950/60 text-amber-200 hover:border-amber-500 hover:text-amber-100`}
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={handleSaveAsNew}
          data-testid="save-target-as-new"
          className={`${buttonClass} border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white`}
        >
          Save as new target
        </button>
      </div>
    );
  }

  const eff = boundTarget ?? coordsMatch;

  if (eff) {
    return (
      <button
        type="button"
        disabled
        data-testid="saved-target-button"
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
      data-testid="save-target-button"
      className={`${buttonClass} border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white`}
    >
      Save target
    </button>
  );
}
