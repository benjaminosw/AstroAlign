'use client';

interface NumberFieldProps {
  id: string;
  label: string;
  fieldValue: string;
  onChange: (_value: string) => void;
  hint?: string;
}

export default function NumberField({ id, label, fieldValue, onChange, hint }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={fieldValue}
        onChange={(event) => onChange(event.target.value)}
        step="any"
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
