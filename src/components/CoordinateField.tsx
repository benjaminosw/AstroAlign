'use client';

import { useEffect, useState } from 'react';

interface CoordinateFieldProps {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (_value: string) => void;
  onError?: (_hasError: boolean) => void;
}

export default function CoordinateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  onError = () => {}
}: CoordinateFieldProps) {
  const [draft, setDraft] = useState(() => String(value));
  const [focused, setFocused] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  function parse(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (min !== undefined && parsed < min) {
      return null;
    }
    if (max !== undefined && parsed > max) {
      return null;
    }
    return parsed;
  }

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = parse(raw);
    const invalid = parsed === null && raw.trim() !== '';
    setHasError(invalid);
    onError(invalid);
    if (parsed !== null) {
      onChange(String(parsed));
    }
  }

  function handleBlur() {
    setFocused(false);
    if (hasError) {
      setDraft(String(value));
      setHasError(false);
      onError(false);
    }
  }

  const errorMessage =
    min !== undefined && max !== undefined
      ? `${label} must be between ${min}° and ${max}°.`
      : `${label} must be a valid number.`;

  return (
    <div>
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        aria-invalid={hasError}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className={`mt-2 w-full rounded-xl border bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 ${
          hasError
            ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/20'
            : 'border-slate-700 focus:border-sky-400 focus:ring-sky-500/20'
        }`}
      />
      {hasError && (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
