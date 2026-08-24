import type { AstroObject, GeographicPoint } from '../../types/astronomy';
import { findRiseSetEventOnLocalDate } from '../astronomy/riseSet';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';
import type { RiseSetType } from '../astronomy/riseSet';

export interface ReverseAlignmentInput {
  object: AstroObject;
  eventType: RiseSetType;
  date: string;
  timeZone: string;
  target: GeographicPoint;
}

export interface ReverseAlignmentResult {
  object: AstroObject;
  eventType: RiseSetType;
  date: string;
  time: string;
  timeZoneLabel: string;
  utcInstant: string;
  objectAzimuth: number;
  objectAltitude: number;
  shootingBearing: number;
  observerDirectionFromTarget: number;
}

export function reciprocalBearing(bearingDegrees: number): number {
  if (!Number.isFinite(bearingDegrees)) {
    throw new Error('Bearing must be a valid number');
  }
  return (((bearingDegrees + 180) % 360) + 360) % 360;
}

export function calculateReverseAlignment(input: ReverseAlignmentInput): ReverseAlignmentResult | null {
  const { object, eventType, date, timeZone, target } = input;

  const event = findRiseSetEventOnLocalDate(object, target, eventType, date, timeZone);
  if (!event) {
    return null;
  }

  const local = formatLocalDateTimeFromUtc(event.instant, timeZone);
  const shootingBearing = event.azimuth;

  return {
    object,
    eventType,
    date,
    time: local.time,
    timeZoneLabel: local.timeZoneLabel,
    utcInstant: event.instant.toISOString(),
    objectAzimuth: event.azimuth,
    objectAltitude: event.altitude,
    shootingBearing,
    observerDirectionFromTarget: reciprocalBearing(shootingBearing)
  };
}
