import type { CalendarEventDraft } from './types';

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const PRODID = '-//AstroAlign//Save to Calendar//EN';

/** RFC 5545 3.3.11 TEXT escaping: backslash, semicolon, comma, newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

/**
 * Folds a content line at 75 octets per RFC 5545 3.1 (continuation lines
 * start with a single space). Octet-aware so multi-byte characters such as
 * emoji are never split mid-sequence.
 */
export function foldContentLine(line: string): string {
  const segments: string[] = [];
  let current = '';
  let budget = MAX_LINE_OCTETS;

  for (const char of Array.from(line)) {
    const size = byteLength(char);
    if (size > budget) {
      segments.push(current);
      current = '';
      budget = MAX_LINE_OCTETS - 1;
    }
    current += char;
    budget -= size;
  }
  segments.push(current);

  return segments.join(CRLF + ' ');
}

export function formatIcsUtc(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Stable content-derived UID so re-importing the same event updates rather than duplicates. */
function stableUid(draft: CalendarEventDraft): string {
  const seed = `${draft.title}|${draft.startUtc.toISOString()}|${draft.endUtc.toISOString()}|${draft.location}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `astroalign-${(hash >>> 0).toString(16).padStart(8, '0')}@astroalign.app`;
}

export function generateIcs(events: CalendarEventDraft[], generatedAt: Date = new Date()): string {
  if (events.length === 0) {
    throw new Error('Cannot generate an empty calendar file.');
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  for (const draft of events) {
    const summary = 'SUMMARY:' + escapeIcsText(draft.title);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${stableUid(draft)}`,
      `DTSTAMP:${formatIcsUtc(generatedAt)}`,
      `DTSTART:${formatIcsUtc(draft.startUtc)}`,
      `DTEND:${formatIcsUtc(draft.endUtc)}`,
      // Fold the full content line (property name included), per RFC 5545 3.1.
      foldContentLine(summary)
    );
    if (draft.description) {
      lines.push(foldContentLine('DESCRIPTION:' + escapeIcsText(draft.description)));
    }
    if (draft.location) {
      lines.push(foldContentLine('LOCATION:' + escapeIcsText(draft.location)));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}

/** Sanitised .ics filename, safe across Windows/macOS/Linux. */
export function buildIcsFilename(events: CalendarEventDraft[]): string {
  if (events.length === 1) {
    return `${events[0].filenameBase}.ics`;
  }
  const dates = events.map((event) => event.date).sort();
  const suffix = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
  return `AstroAlign_Alignments_${suffix}.ics`;
}

/** Triggers a browser download of the given content as an .ics file. Client-side only. */
export function downloadIcsFile(filename: string, content: string): void {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    throw new Error('Calendar file download is only available in the browser.');
  }
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
