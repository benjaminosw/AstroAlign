import type { AstroObject } from '../../types/astronomy';
import type { MoonPhaseInfo } from '../astronomy/lunarPhase';

/** Duration of generated calendar events, in minutes. */
export const EVENT_DURATION_MINUTES = 5;

export interface CalendarCoordinates {
  latitude: number;
  longitude: number;
}

export interface CalendarShootingPosition extends CalendarCoordinates {
  bearingToTarget?: number | null;
  distanceFromStartKm?: number | null;
  pointName?: string | null;
}

/**
 * The minimum data needed to generate a calendar event for an alignment.
 * Deliberately decoupled from SavedAlignment / AlignmentCandidate so the
 * export works for calculated results, found results, shooting corridor
 * results and saved alignments alike. This is a pure client-side action —
 * no calendar account is involved.
 */
export interface CalendarAlignmentInfo {
  object: AstroObject;
  event: 'rise' | 'set' | null;
  /** Local date at the shooting location, YYYY-MM-DD. */
  date: string;
  /** Local time at the shooting location, HH:mm or HH:mm:ss. */
  time: string;
  /** IANA timezone of the shooting location, e.g. Asia/Singapore. */
  timeZone: string;
  alignmentErrorDegrees: number;
  celestialAzimuth?: number | null;
  targetBearing?: number | null;
  moonPhase?: MoonPhaseInfo | null;
  moonIlluminationPercent?: number | null;
  targetName?: string | null;
  observer?: CalendarCoordinates | null;
  targetPoint?: CalendarCoordinates | null;
  shootingPosition?: CalendarShootingPosition | null;
  objectAltitudeDeg?: number | null;
}

export interface CalendarEventDraft {
  title: string;
  description: string;
  location: string;
  startUtc: Date;
  endUtc: Date;
  timeZone: string;
  /** Local ISO date (YYYY-MM-DD) of the event start. */
  date: string;
  filenameBase: string;
}
