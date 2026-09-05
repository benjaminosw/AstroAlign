import type { SelectedLandmark } from '../geocoding/types';
import type { ShootingArea, ShootingAreaPoint } from '../opportunities/types';
import type { AstroObject } from '../../types/astronomy';
import type { MoonPhaseInfo } from '../astronomy/lunarPhase';

export interface SavedPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export type SavedShootingGeometry =
  | { type: 'point'; point: SavedPoint }
  | { type: 'path'; start: SavedPoint; end: SavedPoint }
  | { type: 'points'; points: SavedPoint[] };

export interface SavedTarget {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedShootingLocation {
  id: string;
  name: string;
  geometry: SavedShootingGeometry;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSetup {
  id: string;
  name: string;
  targetId: string;
  shootingLocationId: string;
  createdAt: string;
  updatedAt: string;
}

export type SavedAlignmentSource = 'calculator' | 'finder' | 'shooting';

export interface SavedAlignmentSnapshotPoint {
  latitude: number;
  longitude: number;
  elevation?: number | null;
  name?: string | null;
}

export interface SavedAlignmentShootingPositionSnapshot {
  latitude: number;
  longitude: number;
  bearingToTarget: number;
  alignmentError: number;
  distanceFromStartKm?: number | null;
  zoneStartKm?: number | null;
  zoneEndKm?: number | null;
  source?: string;
  pointName?: string | null;
}

export interface SavedAlignmentShootingLocationSnapshot {
  name?: string | null;
  geometry?: SavedShootingGeometry;
}

/**
 * A saved alignment is a permanent, historical calculated event. It keeps
 * references to related saved entities where applicable, but also stores a
 * snapshot of the values that were calculated, so it remains meaningful even
 * if the original Target or Shooting Setup is later edited or deleted.
 */
export interface SavedAlignment {
  id: string;
  name: string;
  /** Stable key used to avoid saving the same event twice. */
  dedupeKey: string;
  targetId?: string | null;
  shootingSetupId?: string | null;
  source: SavedAlignmentSource;
  object: AstroObject;
  event: 'rise' | 'set' | null;
  date: string;
  time: string;
  timeZone?: string | null;
  celestialAzimuth: number;
  targetBearing: number;
  alignmentError: number;
  toleranceDegrees?: number | null;
  withinTolerance?: boolean | null;
  objectAltitude?: number | null;
  targetAltitude?: number | null;
  moonPhase?: MoonPhaseInfo | null;
  observerSnapshot?: SavedAlignmentSnapshotPoint | null;
  targetSnapshot?: SavedAlignmentSnapshotPoint | null;
  shootingPositionSnapshot?: SavedAlignmentShootingPositionSnapshot | null;
  shootingLocationSnapshot?: SavedAlignmentShootingLocationSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAlignmentInput {
  targetId?: string | null;
  shootingSetupId?: string | null;
  source: SavedAlignmentSource;
  object: AstroObject;
  event: 'rise' | 'set' | null;
  date: string;
  time: string;
  timeZone?: string | null;
  celestialAzimuth: number;
  targetBearing: number;
  alignmentError: number;
  toleranceDegrees?: number | null;
  withinTolerance?: boolean | null;
  objectAltitude?: number | null;
  targetAltitude?: number | null;
  moonPhase?: MoonPhaseInfo | null;
  observerSnapshot?: SavedAlignmentSnapshotPoint | null;
  targetSnapshot?: SavedAlignmentSnapshotPoint | null;
  shootingPositionSnapshot?: SavedAlignmentShootingPositionSnapshot | null;
  shootingLocationSnapshot?: SavedAlignmentShootingLocationSnapshot | null;
}

export type SavedEntityKind = 'target' | 'shootingLocation' | 'setup' | 'alignment';

const COORDINATE_PRECISION = 6;

export function coordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(COORDINATE_PRECISION)},${longitude.toFixed(COORDINATE_PRECISION)}`;
}

export function sameCoordinates(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): boolean {
  return coordinateKey(first.latitude, first.longitude) === coordinateKey(second.latitude, second.longitude);
}

export function samePoint(first: SavedPoint, second: SavedPoint): boolean {
  return first.id === second.id && sameCoordinates(first, second);
}

export function savedPointCount(geometry: SavedShootingGeometry): number {
  if (geometry.type === 'point') {
    return 1;
  }
  if (geometry.type === 'path') {
    return 2;
  }
  return geometry.points.length;
}

export function geometryKey(geometry: SavedShootingGeometry): string {
  if (geometry.type === 'point') {
    return `point:${coordinateKey(geometry.point.latitude, geometry.point.longitude)}`;
  }
  if (geometry.type === 'path') {
    return `path:${coordinateKey(geometry.start.latitude, geometry.start.longitude)}:${coordinateKey(
      geometry.end.latitude,
      geometry.end.longitude
    )}`;
  }
  const coords = geometry.points
    .map((point) => coordinateKey(point.latitude, point.longitude))
    .sort()
    .join('|');
  return `points:${coords}`;
}

export function shootingAreaToGeometry(area: ShootingArea): SavedShootingGeometry {
  if (area.type === 'path') {
    return {
      type: 'path',
      start: { id: area.start.id, name: area.start.name, latitude: area.start.latitude, longitude: area.start.longitude },
      end: { id: area.end.id, name: area.end.name, latitude: area.end.latitude, longitude: area.end.longitude }
    };
  }
  if (area.points.length === 1) {
    const point = area.points[0];
    return {
      type: 'point',
      point: { id: point.id, name: point.name, latitude: point.latitude, longitude: point.longitude }
    };
  }
  return {
    type: 'points',
    points: area.points.map((point) => ({
      id: point.id,
      name: point.name,
      latitude: point.latitude,
      longitude: point.longitude
    }))
  };
}

function toShootingPoint(point: SavedPoint): ShootingAreaPoint {
  return { id: point.id, name: point.name, latitude: point.latitude, longitude: point.longitude };
}

export function geometryToShootingArea(geometry: SavedShootingGeometry): ShootingArea {
  if (geometry.type === 'point') {
    return { type: 'points', points: [toShootingPoint(geometry.point)] };
  }
  if (geometry.type === 'path') {
    return { type: 'path', start: toShootingPoint(geometry.start), end: toShootingPoint(geometry.end) };
  }
  return { type: 'points', points: geometry.points.map(toShootingPoint) };
}

export function targetToLandmark(target: SavedTarget): SelectedLandmark {
  return {
    id: `saved-target-${target.id}`,
    name: target.name,
    latitude: target.latitude,
    longitude: target.longitude
  };
}

export function generatedTargetName(target: { latitude: number; longitude: number }): string {
  return `Target ${coordinateKey(target.latitude, target.longitude)}`;
}

export function generatedLocationName(geometry: SavedShootingGeometry): string {
  if (geometry.type === 'point') {
    const point = geometry.point;
    return `Single point · ${point.name || coordinateKey(point.latitude, point.longitude)}`;
  }
  if (geometry.type === 'path') {
    return `Path · ${geometry.start.name} → ${geometry.end.name}`;
  }
  return `${geometry.points.length} points`;
}

export function geometrySummary(geometry: SavedShootingGeometry): string {
  if (geometry.type === 'point') {
    return coordinateKey(geometry.point.latitude, geometry.point.longitude);
  }
  if (geometry.type === 'path') {
    return `${coordinateKey(geometry.start.latitude, geometry.start.longitude)} → ${coordinateKey(
      geometry.end.latitude,
      geometry.end.longitude
    )}`;
  }
  return `${geometry.points.length} points`;
}

export function savedAlignmentEventLabel(input: { object: AstroObject; event: 'rise' | 'set' | null }): string {
  if (input.event === null) {
    return input.object;
  }
  return `${input.object}${input.event === 'rise' ? 'rise' : 'set'}`;
}

function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function generatedAlignmentName(input: {
  object: AstroObject;
  event: 'rise' | 'set' | null;
  date: string;
  time: string;
  alignmentError: number;
}): string {
  const eventPart = savedAlignmentEventLabel(input);
  return `${eventPart} · ${formatShortDate(input.date)} · ${input.time} · ${input.alignmentError.toFixed(2)}°`;
}

export function savedAlignmentDedupeKey(input: {
  source: SavedAlignmentSource;
  object: AstroObject;
  event: 'rise' | 'set' | null;
  date: string;
  time: string;
  celestialAzimuth: number;
}): string {
  return `${input.source}|${input.object}|${input.event ?? 'none'}|${input.date}|${input.time}|${input.celestialAzimuth.toFixed(3)}`;
}
