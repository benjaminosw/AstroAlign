/**
 * Validation helpers for records persisted to AstroAlignDB.
 *
 * Every record is validated before it is written and again when it is read
 * (so a single corrupted record can be skipped instead of breaking the whole
 * application).
 */

import type { SavedAlignment, SavedShootingGeometry, SavedSetup, SavedTarget } from '../saved/types';
import { validateCoordinates } from '../timezone/validateCoordinates';

function isIsoTimestamp(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateTarget(target: unknown): string | null {
  const record = target as SavedTarget | null | undefined;
  if (!record || typeof record !== 'object') {
    return 'Target record is not an object';
  }
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return 'Target id must be a non-empty string';
  }
  if (typeof record.name !== 'string') {
    return 'Target name must be a string';
  }
  if (!isFiniteNumber(record.latitude) || !isFiniteNumber(record.longitude)) {
    return 'Target coordinates must be numbers';
  }
  const coordinateError = validateCoordinates(record.latitude, record.longitude);
  if (coordinateError) {
    return `Target has invalid coordinates: ${coordinateError}`;
  }
  if (record.elevation !== null && !isFiniteNumber(record.elevation)) {
    return 'Target elevation must be a number or null';
  }
  if (typeof record.notes !== 'string') {
    return 'Target notes must be a string';
  }
  if (!isIsoTimestamp(record.createdAt) || !isIsoTimestamp(record.updatedAt)) {
    return 'Target timestamps must be valid ISO dates';
  }
  return null;
}

function validatePoint(point: unknown, label: string): string | null {
  const record = point as { latitude?: unknown; longitude?: unknown; id?: unknown; name?: unknown } | null;
  if (!record || typeof record !== 'object') {
    return `${label} must be a point object`;
  }
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return `${label} must have a non-empty id`;
  }
  if (typeof record.name !== 'string') {
    return `${label} must have a name string`;
  }
  if (!isFiniteNumber(record.latitude) || !isFiniteNumber(record.longitude)) {
    return `${label} coordinates must be numbers`;
  }
  const coordinateError = validateCoordinates(record.latitude, record.longitude);
  if (coordinateError) {
    return `${label} has invalid coordinates: ${coordinateError}`;
  }
  return null;
}

export function validateShootingGeometry(geometry: unknown): string | null {
  const record = geometry as SavedShootingGeometry | null | undefined;
  if (!record || typeof record !== 'object') {
    return 'Geometry must be an object';
  }
  if (record.type === 'point') {
    return validatePoint(record.point, 'Geometry point');
  }
  if (record.type === 'path') {
    const startError = validatePoint(record.start, 'Path start');
    if (startError) {
      return startError;
    }
    return validatePoint(record.end, 'Path end');
  }
  if (record.type === 'points') {
    if (!Array.isArray(record.points) || record.points.length === 0) {
      return 'Points geometry must contain at least one point';
    }
    for (let index = 0; index < record.points.length; index += 1) {
      const pointError = validatePoint(record.points[index], `Point ${index + 1}`);
      if (pointError) {
        return pointError;
      }
    }
    return null;
  }
  return `Unknown geometry type "${String((record as { type?: unknown }).type)}"`;
}

export function validateShootingLocation(location: unknown): string | null {
  const record = location as SavedShootingLocationLike | null | undefined;
  if (!record || typeof record !== 'object') {
    return 'Shooting location record is not an object';
  }
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return 'Shooting location id must be a non-empty string';
  }
  if (typeof record.name !== 'string') {
    return 'Shooting location name must be a string';
  }
  const geometryError = validateShootingGeometry(record.geometry);
  if (geometryError) {
    return `Shooting location has invalid geometry: ${geometryError}`;
  }
  if (typeof record.notes !== 'string') {
    return 'Shooting location notes must be a string';
  }
  if (!isIsoTimestamp(record.createdAt) || !isIsoTimestamp(record.updatedAt)) {
    return 'Shooting location timestamps must be valid ISO dates';
  }
  return null;
}

interface SavedShootingLocationLike {
  id?: unknown;
  name?: unknown;
  geometry?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function validateSetup(setup: unknown): string | null {
  const record = setup as SavedSetup | null | undefined;
  if (!record || typeof record !== 'object') {
    return 'Setup record is not an object';
  }
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return 'Setup id must be a non-empty string';
  }
  if (typeof record.name !== 'string') {
    return 'Setup name must be a string';
  }
  if (typeof record.targetId !== 'string' || record.targetId.length === 0) {
    return 'Setup targetId must be a non-empty string';
  }
  if (typeof record.shootingLocationId !== 'string' || record.shootingLocationId.length === 0) {
    return 'Setup shootingLocationId must be a non-empty string';
  }
  if (!isIsoTimestamp(record.createdAt) || !isIsoTimestamp(record.updatedAt)) {
    return 'Setup timestamps must be valid ISO dates';
  }
  return null;
}

export function validateSavedAlignment(alignment: unknown): string | null {
  const record = alignment as SavedAlignment | null | undefined;
  if (!record || typeof record !== 'object') {
    return 'Saved alignment record is not an object';
  }
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return 'Saved alignment id must be a non-empty string';
  }
  if (typeof record.name !== 'string') {
    return 'Saved alignment name must be a string';
  }
  if (record.source !== 'calculator' && record.source !== 'finder' && record.source !== 'shooting') {
    return 'Saved alignment source is invalid';
  }
  if (record.object !== 'Sun' && record.object !== 'Moon') {
    return 'Saved alignment object is invalid';
  }
  if (record.event !== null && record.event !== 'rise' && record.event !== 'set') {
    return 'Saved alignment event is invalid';
  }
  if (typeof record.date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(record.date)) {
    return 'Saved alignment date must be an ISO date';
  }
  if (typeof record.time !== 'string') {
    return 'Saved alignment time must be a string';
  }
  if (!isFiniteNumber(record.celestialAzimuth) || !isFiniteNumber(record.targetBearing) || !isFiniteNumber(record.alignmentError)) {
    return 'Saved alignment angles must be numbers';
  }
  if (!isIsoTimestamp(record.createdAt) || !isIsoTimestamp(record.updatedAt)) {
    return 'Saved alignment timestamps must be valid ISO dates';
  }
  return null;
}

export function validateAppStateRecord(record: unknown): string | null {
  const value = record as { key?: unknown; value?: unknown } | null;
  if (!value || typeof value !== 'object') {
    return 'App state record is not an object';
  }
  if (typeof value.key !== 'string' || value.key.length === 0) {
    return 'App state key must be a non-empty string';
  }
  if (value.value === undefined) {
    return 'App state value must not be undefined';
  }
  return null;
}
