'use client';

import { useState, type ChangeEvent } from 'react';

export const TOLERANCE_PRESETS = [0.1, 0.25, 0.5, 1, 2];

export default function TolerancePicker({ value, onChange }: { value: number; onChange: (_value: number) => void }) {
  const [mode, setMode] = useState<'preset' | 'custom'>(TOLERANCE_PRESETS.includes(value) ? 'preset' : 'custom');
  const [customDraft, setCustomDraft] = useState(() => (TOLERANCE_PRESETS.includes(value) ? '' : String(value)));

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
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  }

  return (
    <div>
      <select
        value={selectValue}
        onChange={handleSelect}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        {TOLERANCE_PRESETS.map((option) => (
          <option key={option} value={option}>
            {option}°
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>

      {mode === 'custom' && (
        <input
          type="number"
          min="0"
          step="any"
          value={customDraft}
          onChange={(event) => handleCustomChange(event.target.value)}
          placeholder="e.g. 0.75"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      )}
    </div>
  );
}
