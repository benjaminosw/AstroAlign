'use client';

import { useRef, useState } from 'react';
import { useSavedLocations } from '../lib/saved/savedState';
import { useOptionalAppState } from '../lib/storage/appState';
import { importData, toExportPayload } from '../lib/storage/repository';

export default function DataManagement() {
  const { targets, shootingLocations, setups, savedAlignments, resetAll } = useSavedLocations();
  const appState = useOptionalAppState();
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    const payload = toExportPayload({
      targets,
      shootingLocations,
      shootingSetups: setups,
      savedAlignments,
      appState: appState?.hydratedData?.appState ?? {}
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `astroalign-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus({ kind: 'success', message: 'Saved data exported.' });
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(reader.result));
      } catch {
        setStatus({ kind: 'error', message: 'Import failed: the file is not valid JSON.' });
        return;
      }
      void (async () => {
        const result = await importData(payload);
        if (!result.ok) {
          setStatus({ kind: 'error', message: `Import failed: ${result.problems.join(' ')}` });
          return;
        }
        setStatus({ kind: 'success', message: 'Data imported. Reloading…' });
        window.setTimeout(() => {
          window.location.reload();
        }, 400);
      })();
    };
    reader.onerror = () => {
      setStatus({ kind: 'error', message: 'Import failed: could not read the file.' });
    };
    reader.readAsText(file);
  }

  function handleClear() {
    resetAll();
    setConfirmingClear(false);
    setStatus({ kind: 'success', message: 'All saved data cleared. Reloading…' });
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  return (
    <section data-testid="data-management" className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Your data</h2>
      <p className="mt-1 text-xs text-slate-500">
        Saved targets, shooting locations, setups, saved alignments, and working settings are stored in your browser
        (IndexedDB). Export them as a backup or move them to another device.
      </p>

      {status && (
        <div
          data-testid="data-management-status"
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
            status.kind === 'error' ? 'border border-rose-600 bg-rose-950/60 text-rose-200' : 'text-emerald-200'
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          data-testid="export-data"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Export data
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="import-data"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Import data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleImportFile(file);
            }
            event.target.value = '';
          }}
        />
        {confirmingClear ? (
          <>
            <button
              type="button"
              onClick={handleClear}
              data-testid="confirm-clear-data"
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-500"
            >
              Yes, clear everything
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            data-testid="clear-data"
            className="rounded-xl border border-rose-700/70 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:border-rose-500 hover:text-rose-200"
          >
            Clear all data
          </button>
        )}
      </div>
    </section>
  );
}
