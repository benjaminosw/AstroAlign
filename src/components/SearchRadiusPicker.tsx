'use client';

import { useState, type ChangeEvent } from 'react';

export const SEARCH_RADIUS_PRESETS = [1, 5, 10, 20];

export default function SearchRadiusPicker({
  value,
  onChange,
  id
}: {
  value: number;
  onChange: (_value: number) => void;
  id?: string;
}) {
  const [mode, setMode] = useState<'preset' | 'custom'>(SEARCH_RADIUS_PRESETS.includes(value) ? 'preset' : 'custom');
  const [customDraft, setCustomDraft] = useState(() => (SEARCH_RADIUS_PRESETS.includes(value) ? '' : String(value)));

  const selectValue = mode === 'custom' ? 'custom' : value;

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    const selected = event.target.value;
    if (selected === 'custom') {
      setMode('custom');
      setCustomDraft(String(value));
      return;
    }
    setMode('preset');
    onChange(Number(selected));
  }

  function handleCustomChange(text: string) {
    setCustomDraft(text);
    const trimmed = text.trim();
    if (trimmed === '') {
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChange(parsed);
    }
  }

  return (
    <div>
      <select
        id={id}
        value={selectValue}
        onChange={handleSelect}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        {SEARCH_RADIUS_PRESETS.map((option) => (
          <option key={option} value={option}>
            {option} km
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>

      {mode === 'custom' && (
        <input
          type="number"
          min="0.05"
          step="any"
          value={customDraft}
          onChange={(event) => handleCustomChange(event.target.value)}
          placeholder="e.g. 7.5"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      )}

      <p className="mt-2 text-xs text-slate-500">Distance from the target within which to search.</p>
    </div>
  );
}
