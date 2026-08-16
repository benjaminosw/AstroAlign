'use client';

import type { SavedShootingLocation } from '../lib/saved/types';
import { geometrySummary } from '../lib/saved/types';
import type { LocationDraft, LocationDraftPoint } from './SavedLocationsPage';

interface SavedLocationCardProps {
  location: SavedShootingLocation;
  active: boolean;
  draft: LocationDraft | null;
  onActivate: () => void;
  onUseWithTarget: () => void;
  onStartEdit: () => void;
  onDraftChange: (_patch: Partial<LocationDraft>) => void;
  onDraftPointChange: (_pointId: string, _patch: Partial<LocationDraftPoint>) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onDelete: () => void;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

function typeLabel(type: SavedShootingLocation['geometry']['type']): string {
  if (type === 'path') {
    return 'Path';
  }
  if (type === 'point') {
    return 'Single point';
  }
  return 'Multiple points';
}

export default function SavedLocationCard({
  location,
  active,
  draft,
  onActivate,
  onUseWithTarget,
  onStartEdit,
  onDraftChange,
  onDraftPointChange,
  onSaveDraft,
  onCancelDraft,
  onDelete
}: SavedLocationCardProps) {
  return (
    <div
      data-testid={`saved-location-card-${location.id}`}
      onClick={onActivate}
      className={`cursor-pointer rounded-2xl border p-5 transition ${
        active ? 'border-sky-500 bg-slate-900/90' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
      }`}
    >
      {draft ? (
        <div className="space-y-4" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Edit shooting location</p>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {typeLabel(draft.type)}
            </span>
          </div>
          <div>
            <label htmlFor={`saved-location-${location.id}-name`} className="text-sm text-slate-300">
              Name
            </label>
            <input
              id={`saved-location-${location.id}-name`}
              type="text"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              className={inputClass}
            />
          </div>
          {draft.points.map((point, index) => (
            <div key={point.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {draft.type === 'path' ? (index === 0 ? 'Start point' : 'End point') : `Point ${index + 1}`}
              </p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor={`saved-location-${location.id}-point-${point.id}-name`} className="text-sm text-slate-300">
                    Name
                  </label>
                  <input
                    id={`saved-location-${location.id}-point-${point.id}-name`}
                    type="text"
                    value={point.name}
                    onChange={(event) => onDraftPointChange(point.id, { name: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`saved-location-${location.id}-point-${point.id}-latitude`} className="text-sm text-slate-300">
                      Latitude
                    </label>
                    <input
                      id={`saved-location-${location.id}-point-${point.id}-latitude`}
                      type="number"
                      step="any"
                      value={point.latitude}
                      onChange={(event) => onDraftPointChange(point.id, { latitude: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`saved-location-${location.id}-point-${point.id}-longitude`} className="text-sm text-slate-300">
                      Longitude
                    </label>
                    <input
                      id={`saved-location-${location.id}-point-${point.id}-longitude`}
                      type="number"
                      step="any"
                      value={point.longitude}
                      onChange={(event) => onDraftPointChange(point.id, { longitude: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div>
            <label htmlFor={`saved-location-${location.id}-notes`} className="text-sm text-slate-300">
              Notes
            </label>
            <textarea
              id={`saved-location-${location.id}-notes`}
              value={draft.notes}
              onChange={(event) => onDraftChange({ notes: event.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              data-testid={`saved-location-save-${location.id}`}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={onCancelDraft}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">📷</span>
              <h3 className="truncate text-sm font-semibold text-white">{location.name}</h3>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {typeLabel(location.geometry.type)}
            </span>
          </div>
          <p className="text-xs text-slate-400">{geometrySummary(location.geometry)}</p>
          {location.notes && <p className="text-xs text-slate-400">{location.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onUseWithTarget();
              }}
              data-testid={`saved-location-use-${location.id}`}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Use with target
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
              data-testid={`saved-location-edit-${location.id}`}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              data-testid={`saved-location-delete-${location.id}`}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500 hover:text-rose-200"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
