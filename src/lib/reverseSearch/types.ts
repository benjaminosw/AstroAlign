import type { AstroObject, GeographicPoint } from '../../types/astronomy';
import type { RiseSetObject, RiseSetType } from '../astronomy/riseSet';

export interface ReverseSearchInput {
  target: GeographicPoint;
  date: string;
  timeZone: string;
  object: AstroObject;
  eventType: RiseSetType;
  toleranceDegrees: number;
  searchRadiusKm: number;
  fullMoonOnly?: boolean;
  candidateIntervalMeters?: number;
  lateralSamples?: number;
  signal?: AbortSignal;
  onProgress?: (_completed: number, _total: number) => void;
}

export interface ShootingLocation {
  id: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  bearingToTarget: number;
  targetBearing: number;
  alignmentError: number;
  withinTolerance: boolean;
  targetAltitude: number | null;
}

export interface ReverseSearchEvent {
  body: RiseSetObject;
  type: RiseSetType;
  instant: Date;
  localDate: string;
  localTime: string;
  timeZoneLabel: string;
  azimuth: number;
  altitude: number;
  withinFullMoonWindow: boolean;
}

export interface ReverseSearchResult {
  event: ReverseSearchEvent;
  idealTargetBearing: number;
  idealOutboundBearing: number;
  candidates: ShootingLocation[];
}
