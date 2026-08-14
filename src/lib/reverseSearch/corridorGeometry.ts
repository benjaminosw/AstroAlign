import type { GeographicPoint } from '../../types/astronomy';
import { destinationPoint } from '../geometry/destinationPoint';
import { normalizeAzimuth } from '../geometry/bearing';

export interface CorridorGeometry {
  idealLine: Array<[number, number]>;
  corridorPolygon: Array<[number, number]>;
  searchCircle: Array<[number, number]>;
}

const EDGE_STEPS = 24;
const CIRCLE_STEPS = 72;

export function buildCorridorGeometry(
  target: Pick<GeographicPoint, 'latitude' | 'longitude'>,
  outboundBearing: number,
  toleranceDegrees: number,
  radiusKm: number
): CorridorGeometry {
  const centerBearing = normalizeAzimuth(outboundBearing);
  const halfTolerance = Math.max(0, toleranceDegrees);

  const lineEnd = destinationPoint(target.latitude, target.longitude, centerBearing, radiusKm);
  const idealLine: Array<[number, number]> = [
    [target.longitude, target.latitude],
    [lineEnd.longitude, lineEnd.latitude]
  ];

  const leftEdge: Array<[number, number]> = [];
  const rightEdge: Array<[number, number]> = [];
  for (let step = 0; step <= EDGE_STEPS; step++) {
    const distanceKm = (step / EDGE_STEPS) * radiusKm;
    const left = destinationPoint(target.latitude, target.longitude, normalizeAzimuth(centerBearing - halfTolerance), distanceKm);
    const right = destinationPoint(target.latitude, target.longitude, normalizeAzimuth(centerBearing + halfTolerance), distanceKm);
    leftEdge.push([left.longitude, left.latitude]);
    rightEdge.push([right.longitude, right.latitude]);
  }
  const corridorPolygon: Array<[number, number]> = [...leftEdge, ...rightEdge.reverse(), [target.longitude, target.latitude]];

  const searchCircle: Array<[number, number]> = [];
  for (let step = 0; step < CIRCLE_STEPS; step++) {
    const bearing = (step / CIRCLE_STEPS) * 360;
    const point = destinationPoint(target.latitude, target.longitude, bearing, radiusKm);
    searchCircle.push([point.longitude, point.latitude]);
  }
  searchCircle.push([searchCircle[0][0], searchCircle[0][1]]);

  return { idealLine, corridorPolygon, searchCircle };
}
