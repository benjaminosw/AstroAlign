'use client';

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import type { GeographicPoint } from '../types/astronomy';

export type LocationField = keyof GeographicPoint;

interface LocationEditorProps {
  idPrefix: string;
  title: string;
  icon: 'camera' | 'target';
  values: GeographicPoint;
  onChange: (_field: LocationField, _value: string) => void;
  onErrorChange?: (_hasError: boolean) => void;
  searchNode?: ReactNode;
  summaryNode?: ReactNode;
}

const FIELD_LABELS: Record<LocationField, string> = {
  latitude: 'Latitude',
  longitude: 'Longitude',
  elevation: 'Elevation (m)'
};

const FIELD_ORDER: LocationField[] = ['latitude', 'longitude', 'elevation'];

function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(10)));
}

function parseField(field: LocationField, raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (field === 'latitude' && (parsed < -90 || parsed > 90)) {
    return null;
  }
  if (field === 'longitude' && (parsed < -180 || parsed > 180)) {
    return null;
  }
  return parsed;
}

function errorMessage(field: LocationField): string {
  if (field === 'latitude') {
    return 'Latitude must be between -90° and 90°.';
  }
  if (field === 'longitude') {
    return 'Longitude must be between -180° and 180°.';
  }
  return 'Elevation must be a valid number.';
}

function stringify(point: GeographicPoint): Record<LocationField, string> {
  return {
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    elevation: String(point.elevation)
  };
}

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function LocationEditor({
  idPrefix,
  title,
  icon,
  values,
  onChange,
  onErrorChange = () => {},
  searchNode,
  summaryNode
}: LocationEditorProps) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<LocationField, string>>(() => stringify(values));
  const latitudeRef = useRef<HTMLInputElement>(null);
  const longitudeRef = useRef<HTMLInputElement>(null);
  const elevationRef = useRef<HTMLInputElement>(null);
  const inputRefs: Record<LocationField, RefObject<HTMLInputElement>> = {
    latitude: latitudeRef,
    longitude: longitudeRef,
    elevation: elevationRef
  };

  function computeErrors(current: Record<LocationField, string>): Record<LocationField, boolean> {
    const result = {} as Record<LocationField, boolean>;
    for (const field of FIELD_ORDER) {
      result[field] = current[field].trim() !== '' && parseField(field, current[field]) === null;
    }
    return result;
  }

  const errorMap = computeErrors(drafts);

  function enterEdit(field?: LocationField) {
    setDrafts(stringify(values));
    setEditing(true);
    onErrorChange(false);
    if (field) {
      const input = inputRefs[field].current;
      input?.focus();
      input?.select();
    }
  }

  function handleDraftChange(field: LocationField, raw: string) {
    const next = { ...drafts, [field]: raw };
    setDrafts(next);
    const nextErrors = computeErrors(next);
    onErrorChange(FIELD_ORDER.some((item) => nextErrors[item]));
  }

  function commitEdit() {
    const invalid = FIELD_ORDER.some((field) => parseField(field, drafts[field]) === null);
    if (invalid) {
      onErrorChange(true);
      return;
    }
    for (const field of FIELD_ORDER) {
      const parsed = parseField(field, drafts[field]);
      if (parsed !== null && parsed !== values[field]) {
        onChange(field, String(parsed));
      }
    }
    setEditing(false);
    onErrorChange(false);
  }

  function cancelEdit() {
    setDrafts(stringify(values));
    setEditing(false);
    onErrorChange(false);
  }

  return (
    <section
      data-testid={`${idPrefix}-location-editor`}
      className={editing ? 'rounded-xl border border-sky-400/40 bg-slate-900/60 p-3' : ''}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon === 'camera' ? <CameraIcon /> : <TargetIcon />}
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
        </div>
        <button
          type="button"
          aria-label={editing ? `Save ${title}` : `Edit ${title}`}
          title={editing ? 'Save location' : 'Edit location'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (editing) {
              commitEdit();
            } else {
              enterEdit();
            }
          }}
          className={`rounded-md p-1.5 transition ${
            editing ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-sky-300'
          }`}
        >
          {editing ? <CheckIcon /> : <PencilIcon />}
        </button>
      </div>

      {searchNode && <div className="mt-3">{searchNode}</div>}
      {summaryNode && <div className="mt-3">{summaryNode}</div>}

      {editing ? (
        <div className="mt-3 space-y-3">
          {FIELD_ORDER.map((field) => (
            <div key={field}>
              <label htmlFor={`${idPrefix}-${field}`} className="text-sm text-slate-300">
                {FIELD_LABELS[field]}
              </label>
              <input
                ref={inputRefs[field]}
                id={`${idPrefix}-${field}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={drafts[field]}
                aria-label={FIELD_LABELS[field]}
                aria-invalid={errorMap[field]}
                onChange={(event) => handleDraftChange(field, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitEdit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                className={`mt-1 w-full rounded-xl border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 ${
                  errorMap[field]
                    ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-700 focus:border-sky-400 focus:ring-sky-500/20'
                }`}
              />
            </div>
          ))}
          {FIELD_ORDER.map((field) =>
            errorMap[field] ? (
              <p key={field} className="text-xs text-rose-300" role="alert">
                {errorMessage(field)}
              </p>
            ) : null
          )}
        </div>
      ) : (
        <dl className="mt-3 space-y-1.5 text-sm">
          {FIELD_ORDER.map((field) => (
            <div key={field} className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-400">{FIELD_LABELS[field]}</dt>
              <dd
                className="tabular-nums text-slate-100"
                title={`Double-click to edit ${FIELD_LABELS[field]}`}
                onDoubleClick={() => enterEdit(field)}
              >
                {field === 'elevation' ? `${formatCoordinate(values.elevation)} m` : formatCoordinate(values[field])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
