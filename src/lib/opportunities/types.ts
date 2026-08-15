import type { AstroObject, GeographicPoint } from '../../types/astronomy';
import type { RiseSetType } from '../astronomy/riseSet';
import type { MoonPhaseInfo } from '../astronomy/lunarPhase';
import type { TimeFilterOption } from '../alignment/timeFilter';

export type ShootingAreaMode = 'path' | 'points';

export interface ShootingAreaPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ShootingPathArea {
  type: 'path';
  start: ShootingAreaPoint;
  end: ShootingAreaPoint;
}

export interface ShootingPointsArea {
  type: 'points';
  points: ShootingAreaPoint[];
}

export type ShootingArea = ShootingPathArea | ShootingPointsArea;

export interface ShootingSolution {
  latitude: number;
  longitude: number;
  bearingToTarget: number;
  alignmentError: number;
  distanceFromStartKm: number;
  zoneStartKm: number;
  zoneEndKm: number;
  source: 'path' | 'point';
  pointId?: string;
  pointName?: string;
}

export interface ShootingOpportunity {
  id: string;
  utcInstant: string;
  eventType: RiseSetType;
  eventLabel: string;
  localDate: string;
  localTime: string;
  timeZone: string;
  timeZoneLabel: string;
  object: AstroObject;
  objectAzimuth: number;
  objectAltitude: number;
  moonPhase?: MoonPhaseInfo;
  moonIlluminationPercent?: number;
  position: ShootingSolution;
  score: number;
}

export interface FindShootingOpportunitiesInput {
  target: GeographicPoint;
  area: ShootingArea;
  object: AstroObject;
  eventType: RiseSetType;
  startDate: string;
  endDate: string;
  toleranceDegrees: number;
  timeZone: string;
  signal?: AbortSignal;
  onProgress?: (_completed: number, _total: number) => void;
}

export interface ShootingOpportunityFilters {
  moonPhases: string[] | null;
  timeFilter: TimeFilterOption;
  customStartTime?: string;
  customEndTime?: string;
  fullMoonOnly?: boolean;
}

export function shootingAreaKey(area: ShootingArea): string {
  if (area.type === 'path') {
    return `path:${area.start.latitude},${area.start.longitude}:${area.end.latitude},${area.end.longitude}`;
  }
  return `points:${area.points
    .map((point) => `${point.latitude},${point.longitude}`)
    .sort()
    .join('|')}`;
}
