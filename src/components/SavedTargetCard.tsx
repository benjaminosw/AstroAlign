'use client';

import type { SavedTarget } from '../lib/saved/types';
import type { TargetDraft } from './SavedLocationsPage';

interface SavedTargetCardProps {
  target: SavedTarget;
  active: boolean;
  draft: TargetDraft | null;
  onActivate: () => void;
  onFindShootingOpportunities: () => void;
  onStartEdit: () => void;
  onDraftChange: (_patch: Partial<TargetDraft>) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onDelete: () => void;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

export default function SavedTargetCard({
  target,
  active,
  draft,
  onActivate,
  onFindShootingOpportunities,
  onStartEdit,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
  onDelete
}: SavedTargetCardProps) {
  const elevationText = target.elevation === null ? 'No elevation' : `${target.elevation} m`;

  return (
    <div
      data-testid={`saved-target-card-${target.id}`}
      onClick={onActivate}
      className={`cursor-pointer rounded-2xl border p-5 transition ${
        active ? 'border-sky-500 bg-slate-900/90' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
      }`}
    >
      {draft ? (
        <div className="space-y-4" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Edit target</p>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Target
            </span>
          </div>
          <div>
            <label htmlFor={`saved-target-${target.id}-name`} className="text-sm text-slate-300">
              Name
            </label>
            <input
              id={`saved-target-${target.id}-name`}
              type="text"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`saved-target-${target.id}-latitude`} className="text-sm text-slate-300">
                Latitude
              </label>
              <input
                id={`saved-target-${target.id}-latitude`}
                type="number"
                step="any"
                value={draft.latitude}
                onChange={(event) => onDraftChange({ latitude: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`saved-target-${target.id}-longitude`} className="text-sm text-slate-300">
                Longitude
              </label>
              <input
                id={`saved-target-${target.id}-longitude`}
                type="number"
                step="any"
                value={draft.longitude}
                onChange={(event) => onDraftChange({ longitude: event.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`saved-target-${target.id}-elevation`} className="text-sm text-slate-300">
              Elevation (m)
            </label>
            <input
              id={`saved-target-${target.id}-elevation`}
              type="number"
              step="any"
              value={draft.elevation}
              onChange={(event) => onDraftChange({ elevation: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`saved-target-${target.id}-notes`} className="text-sm text-slate-300">
              Notes
            </label>
            <textarea
              id={`saved-target-${target.id}-notes`}
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
              data-testid={`saved-target-save-${target.id}`}
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
              <span aria-hidden="true">📍</span>
              <h3 className="truncate text-sm font-semibold text-white">{target.name}</h3>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Target
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {target.latitude.toFixed(6)}, {target.longitude.toFixed(6)} · {elevationText}
          </p>
          {target.notes && <p className="text-xs text-slate-400">{target.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFindShootingOpportunities();
              }}
              data-testid={`saved-target-find-${target.id}`}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Find shooting opportunities
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
              data-testid={`saved-target-edit-${target.id}`}
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
              data-testid={`saved-target-delete-${target.id}`}
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
