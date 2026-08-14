'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function wrapValue(value: number, min: number, max: number): number {
  const range = max - min + 1;
  return ((value - min) % range + range) % range + min;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^([0-9]{1,2}):([0-9]{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function ChevronUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function StepButton({ direction, onPress, label }: { direction: 'up' | 'down'; onPress: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="rounded-lg px-3 py-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-100"
    >
      {direction === 'up' ? <ChevronUp /> : <ChevronDown />}
    </button>
  );
}

export default function TimePicker({ value, onChange, label }: { value: string; onChange: (_value: string) => void; label?: string }) {
  const parsed = parseTime(value) ?? { hour: 0, minute: 0 };
  const hour = parsed.hour;
  const minute = parsed.minute;
  const hasValue = value.trim() !== '';

  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const step = useCallback(
    (column: 'hour' | 'minute', delta: number) => {
      const next = formatTime(
        column === 'hour' ? wrapValue(hour + delta, 0, 23) : hour,
        column === 'minute' ? wrapValue(minute + delta, 0, 59) : minute
      );
      setDraft(next);
      onChange(next);
    },
    [hour, minute, onChange]
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || editing) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const column = x < bounds.width / 2 ? 'hour' : 'minute';
      step(column, event.deltaY > 0 ? -1 : 1);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [editing, step]);

  function commit() {
    const parsedDraft = parseTime(draft);
    if (parsedDraft) {
      const next = formatTime(parsedDraft.hour, parsedDraft.minute);
      setDraft(next);
      onChange(next);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  return (
    <div className="mt-2" role="group" aria-label={label}>
      <div
        ref={containerRef}
        className="flex select-none items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2"
      >
        <div className="flex flex-col items-center">
          <StepButton direction="up" onPress={() => step('hour', 1)} label="Increase hour" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to type a time"
            className="w-14 rounded-xl bg-slate-800 px-2 py-2 text-2xl font-semibold tabular-nums text-white transition hover:bg-slate-700"
          >
            {hasValue ? String(hour).padStart(2, '0') : '--'}
          </button>
          <StepButton direction="down" onPress={() => step('hour', -1)} label="Decrease hour" />
        </div>

        <span className="text-2xl font-semibold text-slate-500">:</span>

        <div className="flex flex-col items-center">
          <StepButton direction="up" onPress={() => step('minute', 1)} label="Increase minute" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Click to type a time"
            className="w-14 rounded-xl bg-slate-800 px-2 py-2 text-2xl font-semibold tabular-nums text-white transition hover:bg-slate-700"
          >
            {hasValue ? String(minute).padStart(2, '0') : '--'}
          </button>
          <StepButton direction="down" onPress={() => step('minute', -1)} label="Decrease minute" />
        </div>
      </div>

      {editing && (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
            } else if (event.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          placeholder="HH:MM"
          className="mt-2 w-full rounded-xl border border-sky-400 bg-slate-900 px-3 py-2 text-center text-2xl font-semibold tabular-nums text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      )}

      <p className="mt-2 text-xs text-slate-500">
        Local civil time at the observer&apos;s location. Use the arrows, scroll, or click to type.
      </p>
    </div>
  );
}
