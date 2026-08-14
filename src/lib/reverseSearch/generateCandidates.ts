import type { GeographicPoint } from '../../types/astronomy';
import { destinationPoint } from '../geometry/destinationPoint';
import { normalizeAzimuth, oppositeBearing } from '../geometry/bearing';

export interface CandidatePoint {
  latitude: number;
  longitude: number;
  distanceKm: number;
  samplingBearing: number;
}

export interface CandidateGenerationInput {
  target: GeographicPoint;
  eventAzimuth: number;
  toleranceDegrees: number;
  searchRadiusKm: number;
  intervalMeters?: number;
  lateralSamples?: number;
}

export function resolveCandidateInterval(radiusKm: number): number {
  const intervalKm = Math.max(0.05, Math.min(0.25, radiusKm * 0.02));
  return intervalKm;
}

export function generateCandidates(input: CandidateGenerationInput): CandidatePoint[] {
  const { target, eventAzimuth, toleranceDegrees, searchRadiusKm } = input;

  if (searchRadiusKm <= 0) {
    return [];
  }

  const intervalKm = resolveCandidateInterval(searchRadiusKm);
  const centerBearing = oppositeBearing(eventAzimuth);
  const lateralCount = Math.max(1, Math.floor(input.lateralSamples ?? 5));
  const halfTolerance = Math.max(0, toleranceDegrees);

  const candidates: CandidatePoint[] = [];
  const stepCount = Math.max(1, Math.ceil(searchRadiusKm / intervalKm));

  for (let step = 1; step <= stepCount; step++) {
    const distanceKm = step * intervalKm;
    if (distanceKm > searchRadiusKm) {
      break;
    }

    for (let lateralIndex = 0; lateralIndex < lateralCount; lateralIndex++) {
      const offset = lateralCount <= 1 ? 0 : (lateralIndex / (lateralCount - 1) - 0.5) * 2;
      const samplingBearing = normalizeAzimuth(centerBearing + offset * halfTolerance);
      const point = destinationPoint(target.latitude, target.longitude, samplingBearing, distanceKm);

      candidates.push({
        latitude: point.latitude,
        longitude: point.longitude,
        distanceKm,
        samplingBearing
      });
    }
  }

  return candidates;
}
