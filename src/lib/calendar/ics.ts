import type { SavedAlignment } from '../saved/types';
import { buildCalendarEventFields } from './eventContent';
import type { ReminderMinutes } from './types';

export function reminderTriggerIcs(minutes: ReminderMinutes): string | null {
  if (minutes <= 0) {
    return null;
  }
  if (minutes >= 10080) {
    return '-P1W';
  }
  if (minutes >= 1440) {
    return '-P1D';
  }
  return `-PT${minutes}M`;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n ');
}

/**
 * Builds an RFC 5545 .ics file for a saved alignment. This is the fallback
 * calendar path — events are imported into the user's calendar app, so
 * AstroAlign can only display them, never update or remove them later.
 */
export function buildIcsCalendar(
  alignment: SavedAlignment,
  targetName: string | null,
  reminderMinutes: ReminderMinutes
): { fileName: string; content: string } {
  const fields = buildCalendarEventFields(alignment, targetName, 5, reminderMinutes);
  const trigger = reminderTriggerIcs(reminderMinutes);

  const rawLines: Array<string | null> = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AstroAlign//AstroAlign Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${alignment.id}@astroalign`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(fields.start)}`,
    `DTEND:${toIcsUtc(fields.end)}`,
    `SUMMARY:${escapeIcsText(fields.title)}`,
    `DESCRIPTION:${escapeIcsText(fields.description)}`,
    fields.location ? `LOCATION:${escapeIcsText(fields.location)}` : null,
    'TRANSP:OPAQUE',
    trigger ? 'BEGIN:VALARM' : null,
    trigger ? 'ACTION:DISPLAY' : null,
    trigger ? `TRIGGER:${trigger}` : null,
    trigger ? 'END:VALARM' : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const folded = rawLines.filter((line): line is string => line !== null).map(foldLine);
  const safeName = alignment.name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

  return {
    fileName: `${safeName}.ics`,
    content: `${folded.join('\r\n')}\r\n`
  };
}
