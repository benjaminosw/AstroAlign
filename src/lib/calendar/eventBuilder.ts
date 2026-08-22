import { ASTRO_OBJECT } from '../../types/astronomy';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { EVENT_DURATION_MINUTES } from './types';
import type { CalendarAlignmentInfo, CalendarEventDraft } from './types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

interface Subject {
  emoji: string;
  label: string;
}

function moonEventLabel(event: 'rise' | 'set' | null): string {
  if (event === 'rise') {
    return 'Moonrise';
  }
  if (event === 'set') {
    return 'Moonset';
  }
  return 'Moon';
}

function subjectFor(info: CalendarAlignmentInfo): Subject {
  if (info.object === ASTRO_OBJECT.Moon) {
    if (info.moonPhase?.name && info.moonPhase?.emoji) {
      return { emoji: info.moonPhase.emoji, label: info.moonPhase.name };
    }
    return { emoji: '\u{1F319}', label: moonEventLabel(info.event) };
  }
  if (info.event === 'rise') {
    return { emoji: '\u{1F305}', label: 'Sunrise' };
  }
  if (info.event === 'set') {
    return { emoji: '\u{1F307}', label: 'Sunset' };
  }
  return { emoji: '\u2600\uFE0F', label: ASTRO_OBJECT.Sun };
}

function cleanTargetName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatCalendarTitle(info: CalendarAlignmentInfo): string {
  const subject = subjectFor(info);
  const targetName = cleanTargetName(info.targetName);
  if (targetName) {
    return `${subject.emoji} ${subject.label} \u2014 ${targetName} Alignment`;
  }
  return `${subject.emoji} ${subject.label} Alignment \u2014 AstroAlign`;
}

export function formatCoordinatePair(point: { latitude: number; longitude: number }): string {
  return `${point.latitude.toFixed(7)}, ${point.longitude.toFixed(7)}`;
}

function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) {
    return isoDate;
  }
  return `${Number(day)} ${MONTH_NAMES[monthIndex]} ${year}`;
}

function normalizeTime(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) {
    return `${time}:00`;
  }
  return time;
}

function formatDistanceFromStart(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

export function resolveEventLocation(info: CalendarAlignmentInfo): string {
  if (info.shootingPosition) {
    return formatCoordinatePair(info.shootingPosition);
  }
  if (info.observer) {
    return formatCoordinatePair(info.observer);
  }
  return '';
}

export function buildDescription(info: CalendarAlignmentInfo): string {
  const sections: Array<[string, string]> = [];
  const targetName = cleanTargetName(info.targetName);

  if (targetName) {
    sections.push(['Target', targetName]);
  }
  sections.push(['Object', info.object]);
  if (info.event !== null) {
    sections.push([
      'Event',
      info.object === ASTRO_OBJECT.Moon ? moonEventLabel(info.event) : `${info.object}${info.event}`
    ]);
  }

  if (info.object === ASTRO_OBJECT.Moon && info.moonPhase?.name) {
    let phaseValue = info.moonPhase.name;
    const illumination =
      info.moonIlluminationPercent ?? (info.moonPhase as { illuminationPercent?: number }).illuminationPercent;
    if (typeof illumination === 'number' && Number.isFinite(illumination)) {
      phaseValue += ` (${illumination.toFixed(0)}% illuminated)`;
    }
    sections.push(['Moon Phase', phaseValue]);
  }

  sections.push(['Date', formatLongDate(info.date)]);
  sections.push(['Time', normalizeTime(info.time)]);
  sections.push(['Alignment Error', `${info.alignmentErrorDegrees.toFixed(2)}\u00B0`]);

  const shootingLocation = resolveEventLocation(info);
  if (shootingLocation) {
    sections.push(['Shooting Location', shootingLocation]);
  }
  if (
    info.shootingPosition &&
    typeof info.shootingPosition.distanceFromStartKm === 'number' &&
    Number.isFinite(info.shootingPosition.distanceFromStartKm)
  ) {
    sections.push([
      'Distance from corridor start',
      formatDistanceFromStart(info.shootingPosition.distanceFromStartKm)
    ]);
  }
  if (info.targetPoint) {
    sections.push(['Target Coordinates', formatCoordinatePair(info.targetPoint)]);
  }
  const bearing = info.targetBearing ?? info.shootingPosition?.bearingToTarget ?? null;
  if (bearing !== null && Number.isFinite(bearing)) {
    sections.push(['Bearing', `${bearing.toFixed(2)}\u00B0`]);
  }
  if (info.celestialAzimuth !== null && info.celestialAzimuth !== undefined && Number.isFinite(info.celestialAzimuth)) {
    sections.push([`${info.object} Azimuth`, `${info.celestialAzimuth.toFixed(2)}\u00B0`]);
  }
  if (info.objectAltitudeDeg !== null && info.objectAltitudeDeg !== undefined && Number.isFinite(info.objectAltitudeDeg)) {
    sections.push(['Altitude', `${info.objectAltitudeDeg.toFixed(2)}\u00B0`]);
  }

  const lines = ['ASTROALIGN ALIGNMENT'];
  for (const [label, value] of sections) {
    lines.push('', label + ':', value);
  }
  lines.push('', 'AstroAlign');
  return lines.join('\n');
}

function sanitizeFilenamePart(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return ascii.length > 0 ? ascii.slice(0, 48) : '';
}

function eventSubjectToken(info: CalendarAlignmentInfo): string {
  return sanitizeFilenamePart(subjectFor(info).label);
}

export function buildFilenameBase(info: CalendarAlignmentInfo): string {
  const parts = ['AstroAlign'];
  const targetPart = cleanTargetName(info.targetName) ? sanitizeFilenamePart(info.targetName!) : '';
  if (targetPart) {
    parts.push(targetPart);
  }
  const subjectPart = eventSubjectToken(info);
  if (subjectPart) {
    parts.push(subjectPart);
  }
  parts.push(info.date);
  return parts.join('_');
}

/** Builds a pre-filled calendar event draft from alignment data. Pure and synchronous. */
export function buildCalendarEvent(info: CalendarAlignmentInfo): CalendarEventDraft {
  const normalizedTime = normalizeTime(info.time);
  const startUtc = convertLocalTimeToUtc(info.date, normalizedTime, info.timeZone);
  const endUtc = new Date(startUtc.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);

  return {
    title: formatCalendarTitle(info),
    description: buildDescription(info),
    location: resolveEventLocation(info),
    startUtc,
    endUtc,
    timeZone: info.timeZone,
    date: info.date,
    filenameBase: buildFilenameBase(info)
  };
}

export function buildCalendarEvents(infos: CalendarAlignmentInfo[]): CalendarEventDraft[] {
  return infos.map((info) => buildCalendarEvent(info));
}

export interface EventPreviewParts {
  title: string;
  /** e.g. "29 Aug 2026" rendered in the event's own timezone. */
  dateLine: string;
  /** e.g. "19:42–19:47" rendered in the event's own timezone. */
  timeLine: string;
}

/** Compact human-readable preview of a generated event, shown before export. */
export function formatEventPreview(draft: CalendarEventDraft): EventPreviewParts {
  let dateLine = '';
  let timeLine = '';
  try {
    dateLine = new Intl.DateTimeFormat('en-GB', {
      timeZone: draft.timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(draft.startUtc);
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: draft.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    timeLine = `${timeFormatter.format(draft.startUtc)}\u2013${timeFormatter.format(draft.endUtc)}`;
  } catch {
    dateLine = draft.date;
    timeLine = '';
  }
  return { title: draft.title, dateLine, timeLine };
}
