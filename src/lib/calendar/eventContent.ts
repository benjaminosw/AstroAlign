import type { SavedAlignment } from '../saved/types';
import { savedAlignmentEventLabel } from '../saved/types';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { getTimezoneFromCoordinates } from '../timezone/getTimezoneFromCoordinates';
import type { ReminderMinutes } from './types';

export interface CalendarEventFields {
  title: string;
  description: string;
  location: string | null;
  timeZone: string;
  start: string;
  end: string;
  reminderMinutes: ReminderMinutes;
}

/**
 * The timezone in which the alignment event happened, expressed in the
 * observer/shooting-area timezone. Saved alignments carry the timezone when
 * they were created; otherwise it is derived from the observer coordinates.
 */
export function effectiveAlignmentTimeZone(alignment: SavedAlignment): string {
  if (alignment.timeZone) {
    return alignment.timeZone;
  }
  const point = alignment.observerSnapshot ?? alignment.targetSnapshot;
  if (point) {
    try {
      const lookup = getTimezoneFromCoordinates(point.latitude, point.longitude);
      if (lookup.timeZone) {
        return lookup.timeZone;
      }
    } catch {
      // Fall through to UTC.
    }
  }
  return 'UTC';
}

export function calendarEventStartUtc(alignment: SavedAlignment, timeZone: string): string {
  return convertLocalTimeToUtc(alignment.date, alignment.time, timeZone).toISOString();
}

export function calendarEventEndUtc(startUtc: string, durationMinutes: number): string {
  const start = new Date(startUtc);
  return new Date(start.getTime() + durationMinutes * 60_000).toISOString();
}

export function calendarEventTitle(alignment: SavedAlignment, targetName: string | null): string {
  const label = savedAlignmentEventLabel(alignment);
  const prefix = alignment.moonPhase?.emoji ? `${alignment.moonPhase.emoji} ` : '';
  const subject = targetName && targetName.trim().length > 0 ? targetName.trim() : 'AstroAlign alignment';
  return `${prefix}${label} — ${subject}`;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatLatLong(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function calendarEventDescription(alignment: SavedAlignment, targetName: string | null): string {
  const lines: string[] = ['ASTROALIGN ALIGNMENT'];
  lines.push('');
  lines.push(`Target: ${targetName && targetName.trim().length > 0 ? targetName.trim() : '—'}`);
  lines.push(`Object: ${alignment.object}`);
  lines.push(`Event: ${alignment.event === null ? 'Direct alignment' : savedAlignmentEventLabel(alignment)}`);
  lines.push(`Date: ${formatDate(alignment.date)}`);
  lines.push(`Time: ${alignment.time}`);
  if (alignment.timeZone) {
    lines.push(`Time zone: ${alignment.timeZone}`);
  }
  if (alignment.moonPhase) {
    lines.push(
      `Moon phase: ${alignment.moonPhase.name} (${alignment.moonPhase.emoji}, ${alignment.moonPhase.illuminationPercent.toFixed(1)}% illuminated)`
    );
  }
  lines.push(`Alignment error: ${alignment.alignmentError.toFixed(2)}°`);
  if (alignment.toleranceDegrees !== null && alignment.toleranceDegrees !== undefined) {
    lines.push(`Tolerance: ${alignment.toleranceDegrees.toFixed(2)}°`);
  }
  lines.push('');
  if (alignment.observerSnapshot) {
    lines.push(`Observer: ${formatLatLong(alignment.observerSnapshot.latitude, alignment.observerSnapshot.longitude)}`);
  }
  if (alignment.targetSnapshot) {
    lines.push(`Target: ${formatLatLong(alignment.targetSnapshot.latitude, alignment.targetSnapshot.longitude)}`);
  }
  const shootingPosition = alignment.shootingPositionSnapshot;
  if (shootingPosition) {
    lines.push(`Shooting position: ${formatLatLong(shootingPosition.latitude, shootingPosition.longitude)}`);
    if (shootingPosition.distanceFromStartKm !== null && shootingPosition.distanceFromStartKm !== undefined) {
      lines.push(`Position along corridor: ${shootingPosition.distanceFromStartKm.toFixed(2)} km from start`);
    }
    if (shootingPosition.zoneStartKm !== null && shootingPosition.zoneStartKm !== undefined) {
      lines.push(
        `Valid zone: ${shootingPosition.zoneStartKm.toFixed(2)}–${shootingPosition.zoneEndKm?.toFixed(2) ?? ''} km from start`
      );
    }
  }
  lines.push(`Target bearing: ${alignment.targetBearing.toFixed(2)}°`);
  lines.push(`Celestial azimuth: ${alignment.celestialAzimuth.toFixed(2)}°`);
  return lines.join('\n');
}

/**
 * Exact event location: the precise shooting position when one was calculated
 * (never the corridor midpoint), otherwise the observer location.
 */
export function calendarEventLocation(alignment: SavedAlignment): string | null {
  const position = alignment.shootingPositionSnapshot ?? alignment.observerSnapshot;
  if (!position) {
    return null;
  }
  return formatLatLong(position.latitude, position.longitude);
}

export function buildCalendarEventFields(
  alignment: SavedAlignment,
  targetName: string | null,
  durationMinutes: number,
  reminderMinutes: ReminderMinutes
): CalendarEventFields {
  const timeZone = effectiveAlignmentTimeZone(alignment);
  const start = calendarEventStartUtc(alignment, timeZone);
  return {
    title: calendarEventTitle(alignment, targetName),
    description: calendarEventDescription(alignment, targetName),
    location: calendarEventLocation(alignment),
    timeZone,
    start,
    end: calendarEventEndUtc(start, durationMinutes),
    reminderMinutes
  };
}
