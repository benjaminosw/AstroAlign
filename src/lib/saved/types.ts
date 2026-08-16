import type { SelectedLandmark } from '../geocoding/types';
import type { ShootingArea, ShootingAreaPoint } from '../opportunities/types';

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

export type SavedEntityKind = 'target' | 'shootingLocation' | 'setup';

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
