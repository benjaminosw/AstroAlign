'use client';

import { useMemo, useState } from 'react';
import { useSavedLocations } from '../lib/saved/savedState';
import SavedAlignmentCard from './SavedAlignmentCard';

export default function SavedAlignmentsPage() {
  const { savedAlignments, targets, updateSavedAlignment, deleteSavedAlignment } = useSavedLocations();
  const [notice, setNotice] = useState<string | null>(null);

  const sortedAlignments = useMemo(
    () =>
      [...savedAlignments].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return b.time.localeCompare(a.time);
      }),
    [savedAlignments]
  );

  function handleDelete(alignment: (typeof savedAlignments)[number]) {
    if (!window.confirm(`Delete saved alignment "${alignment.name}"?`)) {
      return;
    }
    deleteSavedAlignment(alignment.id);
    setNotice(`Deleted saved alignment "${alignment.name}".`);
  }

  function handleRename(alignment: (typeof savedAlignments)[number], name: string) {
    updateSavedAlignment(alignment.id, { name });
    setNotice(`Renamed alignment to "${name}".`);
  }

  return (
    <div data-testid="saved-alignments-page" className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
          Saved alignments ({savedAlignments.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Alignments you saved from Calculate alignment, Find alignments, or Find shooting opportunities — preserved
          between sessions.
        </p>
      </div>

      {notice && (
        <div
          data-testid="saved-alignments-notice"
          className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-600 bg-emerald-950/60 p-4 text-sm text-emerald-200"
        >
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-emerald-300 transition hover:bg-emerald-900 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {sortedAlignments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
          No saved alignments yet. Use Save alignment on a calculated alignment, a found alignment, or a shooting
          opportunity — they will appear here, even after a refresh.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedAlignments.map((alignment) => {
            const target = alignment.targetId
              ? (targets.find((item) => item.id === alignment.targetId) ?? null)
              : null;
            const targetName = target?.name ?? (alignment.targetSnapshot?.name ?? null);
            return (
              <SavedAlignmentCard
                key={alignment.id}
                alignment={alignment}
                targetName={targetName}
                onRename={(name) => handleRename(alignment, name)}
                onDelete={() => handleDelete(alignment)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
