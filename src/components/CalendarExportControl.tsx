'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCalendarEvents, formatEventPreview } from '../lib/calendar/eventBuilder';
import { buildGoogleCalendarUrl } from '../lib/calendar/googleCalendar';
import { buildIcsFilename, downloadIcsFile, generateIcs } from '../lib/calendar/ics';
import type { CalendarAlignmentInfo } from '../lib/calendar/types';

interface CalendarExportControlProps {
  /** One info per alignment. A single entry enables the Google Calendar option; bulk uses .ics. */
  events: CalendarAlignmentInfo[];
  triggerLabel?: string;
  testId?: string;
}

const triggerClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-200 transition hover:bg-slate-800';

export default function CalendarExportControl({
  events,
  triggerLabel = '\u{1F4C5} Save to Calendar',
  testId = 'calendar-export'
}: CalendarExportControlProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const drafts = useMemo(() => {
    try {
      return buildCalendarEvents(events);
    } catch {
      return [];
    }
  }, [events]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const isBulk = drafts.length > 1;
  const single = isBulk ? null : drafts[0] ?? null;
  const preview = single ? formatEventPreview(single) : null;
  const googleUrl = single ? buildGoogleCalendarUrl(single) : null;
  const disabled = drafts.length === 0;

  function handleDownload() {
    try {
      const filename = buildIcsFilename(drafts);
      const content = generateIcs(drafts);
      downloadIcsFile(filename, content);
      setStatus(`Downloaded .ics \u2713 (${drafts.length} event${drafts.length === 1 ? '' : 's'})`);
      setOpen(false);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  function handleGoogleOpened() {
    setStatus('Opened in Google Calendar \u2014 review and save it there');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setStatus(null);
          setOpen((value) => !value);
        }}
        className={`${triggerClass} px-3 py-2 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          data-testid={`${testId}-menu`}
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
        >
          {preview && (
            <div className="space-y-1">
              <p data-testid={`${testId}-preview-title`} className="text-sm font-semibold text-white">
                {preview.title}
              </p>
              <p className="text-xs tabular-nums text-slate-300">
                {preview.dateLine} · {preview.timeLine}
              </p>
              {single?.location && (
                <p className="truncate text-xs text-slate-400" title={single.location}>
                  {'\u{1F4CD}'} {single.location}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {events[0].object}
                {events[0].moonPhase ? ` · ${events[0].moonPhase.name}` : ''} ·{' '}
                {events[0].alignmentErrorDegrees.toFixed(2)}
                {'\u00B0'} error
              </p>
            </div>
          )}

          <div className="mt-3 grid gap-2">
            {!isBulk && googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`${testId}-google`}
                onClick={handleGoogleOpened}
                className="rounded-xl bg-sky-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Add to Google Calendar {'\u2197'}
              </a>
            )}
            <button
              type="button"
              data-testid={`${testId}-ics`}
              onClick={handleDownload}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isBulk ? 'bg-sky-500 text-slate-950 hover:bg-sky-400' : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isBulk ? `Download visible results (.ics)` : 'Download .ics'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {isBulk
              ? 'Google Calendar does not support adding many events via a link — import the .ics file instead.'
              : 'Opens Google Calendar with details pre-filled — you review and save the event there. No account connection.'}
          </p>
        </div>
      )}

      {status && !open && (
        <p role="status" data-testid={`${testId}-status`} className="mt-1.5 text-[11px] font-medium text-emerald-300">
          {status}
        </p>
      )}
    </div>
  );
}
