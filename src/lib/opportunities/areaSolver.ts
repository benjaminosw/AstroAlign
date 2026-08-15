import type { GeographicPoint } from '../../types/astronomy';
import type { ShootingArea, ShootingAreaPoint, ShootingSolution } from './types';
import { pathPointAtFraction, pathTotalLengthKm, solvePathPositions } from './pathGeometry';
import { initialBearing } from '../geometry/bearing';
import { angularDifference } from '../geometry/angularSeparation';

export interface SolveAreaInput {
  area: ShootingArea;
  target: GeographicPoint;
  azimuth: number;
  toleranceDegrees: number;
}

export interface SolveAreaResult {
  solutions: ShootingSolution[];
  pathZones: Array<{
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
  }>;
  mode: ShootingArea['type'];
}

function scorePoint(
  point: ShootingAreaPoint,
  target: GeographicPoint,
  azimuth: number,
  toleranceDegrees: number
): ShootingSolution | null {
  const bearingToTarget = initialBearing(point.latitude, point.longitude, target.latitude, target.longitude);
  const alignmentError = angularDifference(bearingToTarget, azimuth);
  if (alignmentError > toleranceDegrees + 1e-9) {
    return null;
  }
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    bearingToTarget,
    alignmentError,
    distanceFromStartKm: 0,
    zoneStartKm: 0,
    zoneEndKm: 0,
    source: 'point',
    pointId: point.id,
    pointName: point.name
  };
}

export function solveAreaShootingPositions(input: SolveAreaInput): SolveAreaResult {
  const { area, target, azimuth, toleranceDegrees } = input;

  if (area.type === 'points') {
    const solutions: ShootingSolution[] = [];
    for (const point of area.points) {
      const solution = scorePoint(point, target, azimuth, toleranceDegrees);
      if (solution) {
        solutions.push(solution);
      }
    }
    solutions.sort((a, b) => a.alignmentError - b.alignmentError);
    return { solutions, pathZones: [], mode: 'points' };
  }

  const result = solvePathPositions({
    start: area.start,
    end: area.end,
    target,
    azimuth,
    toleranceDegrees
  });

  const solutions: ShootingSolution[] = [];
  if (result.best) {
    solutions.push({
      latitude: result.best.latitude,
      longitude: result.best.longitude,
      bearingToTarget: result.best.bearingToTarget,
      alignmentError: result.best.alignmentError,
      distanceFromStartKm: result.best.distanceFromStartKm,
      zoneStartKm: result.zones[0]?.startDistanceKm ?? 0,
      zoneEndKm: result.zones[0]?.endDistanceKm ?? 0,
      source: 'path'
    });
  }

  const pathZones = result.zones.map((zone) => {
    const lengthKm = pathTotalLengthKm(area.start, area.end);
    const bearingDegrees = initialBearing(area.start.latitude, area.start.longitude, area.end.latitude, area.end.longitude);
    const startPoint = pathPointAtFraction(area.start, area.end, lengthKm, bearingDegrees, zone.startFraction);
    const endPoint = pathPointAtFraction(area.start, area.end, lengthKm, bearingDegrees, zone.endFraction);
    return {
      start: { latitude: startPoint.latitude, longitude: startPoint.longitude },
      end: { latitude: endPoint.latitude, longitude: endPoint.longitude }
    };
  });

  return { solutions, pathZones, mode: 'path' };
}
