'use client';

import type { SavedSetup, SavedShootingLocation, SavedTarget } from '../lib/saved/types';
import type { SetupDraft } from './SavedLocationsPage';

interface SavedSetupCardProps {
  setup: SavedSetup;
  targetName: string;
  locationName: string;
  active: boolean;
  draft: SetupDraft | null;
  targets: SavedTarget[];
  shootingLocations: SavedShootingLocation[];
  onActivate: () => void;
  onOpen: () => void;
  onStartEdit: () => void;
  onDraftChange: (_patch: Partial<SetupDraft>) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onDelete: () => void;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

export default function SavedSetupCard({
  setup,
  targetName,
  locationName,
  active,
  draft,
  targets,
  shootingLocations,
  onActivate,
  onOpen,
  onStartEdit,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
  onDelete
}: SavedSetupCardProps) {
  return (
    <div
      data-testid={`saved-setup-card-${setup.id}`}
      onClick={onActivate}
      className={`cursor-pointer rounded-2xl border p-5 transition ${
        active ? 'border-sky-500 bg-slate-900/90' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
      }`}
    >
      {draft ? (
        <div className="space-y-4" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Edit setup</p>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Setup
            </span>
          </div>
          <div>
            <label htmlFor={`saved-setup-${setup.id}-name`} className="text-sm text-slate-300">
              Name
            </label>
            <input
              id={`saved-setup-${setup.id}-name`}
              type="text"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`saved-setup-${setup.id}-target`} className="text-sm text-slate-300">
                Target
              </label>
              <select
                id={`saved-setup-${setup.id}-target`}
                value={draft.targetId}
                onChange={(event) => onDraftChange({ targetId: event.target.value })}
                className={inputClass}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`saved-setup-${setup.id}-location`} className="text-sm text-slate-300">
                Shooting location
              </label>
              <select
                id={`saved-setup-${setup.id}-location`}
                value={draft.shootingLocationId}
                onChange={(event) => onDraftChange({ shootingLocationId: event.target.value })}
                className={inputClass}
              >
                {shootingLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              data-testid={`saved-setup-save-${setup.id}`}
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
              <span aria-hidden="true">🔗</span>
              <h3 className="truncate text-sm font-semibold text-white">{setup.name}</h3>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Setup
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {targetName} <span aria-hidden="true">→</span> {locationName}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              data-testid={`saved-setup-open-${setup.id}`}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Open
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
              data-testid={`saved-setup-edit-${setup.id}`}
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
              data-testid={`saved-setup-delete-${setup.id}`}
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
