'use client';

import { useSavedLocations } from '../lib/saved/savedState';
import { savedAlignmentDedupeKey } from '../lib/saved/types';
import type { SaveAlignmentInput } from '../lib/saved/types';

interface SaveAllAlignmentsControlProps {
  inputs: SaveAlignmentInput[];
}

export default function SaveAllAlignmentsControl({ inputs }: SaveAllAlignmentsControlProps) {
  const { addSavedAlignment, findSavedAlignmentByDedupeKey } = useSavedLocations();

  const unsavedInputs = inputs.filter(
    (input) => findSavedAlignmentByDedupeKey(savedAlignmentDedupeKey(input)) === null
  );

  function handleSaveAll() {
    for (const input of unsavedInputs) {
      addSavedAlignment(input);
    }
  }

  return (
    <button
      type="button"
      data-testid="save-all-alignments-button"
      onClick={handleSaveAll}
      disabled={unsavedInputs.length === 0}
      className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
        unsavedInputs.length === 0
          ? 'cursor-default bg-emerald-500/15 text-emerald-300'
          : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {unsavedInputs.length === 0
        ? 'All saved ✓'
        : `\u{1F4BE} Save all (${unsavedInputs.length})`}
    </button>
  );
}
