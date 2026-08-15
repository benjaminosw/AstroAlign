import type { GeographicPoint } from '../../types/astronomy';
import type { ShootingAreaPoint } from './types';
import { greatCircleDistanceKm } from '../geometry/distance';
import { destinationPoint } from '../geometry/destinationPoint';
import { initialBearing } from '../geometry/bearing';
import { angularDifference } from '../geometry/angularSeparation';

const SEGMENTS = 384;
const NEAR_TARGET_METERS = 2;
const EPSILON_DEGREES = 1e-9;
const BISECTION_ITERATIONS = 18;

export interface PathSample {
  fraction: number;
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  distanceToTargetKm: number;
  bearingToTarget: number;
  error: number;
  valid: boolean;
}

export interface PathZone {
  startFraction: number;
  endFraction: number;
  startDistanceKm: number;
  endDistanceKm: number;
}

export interface PathBestPosition {
  fraction: number;
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  bearingToTarget: number;
  alignmentError: number;
}

export interface PathPositionResult {
  best: PathBestPosition | null;
  zones: PathZone[];
}

export interface SolvePathPositionsInput {
  start: ShootingAreaPoint;
  end: ShootingAreaPoint;
  target: GeographicPoint;
  azimuth: number;
  toleranceDegrees: number;
}

export function signedBearingDelta(bearingFrom: number, bearingTo: number): number {
  let delta = (bearingTo - bearingFrom) % 360;
  if (delta > 180) {
    delta -= 360;
  }
  if (delta < -180) {
    delta += 360;
  }
  return delta;
}

export function pathTotalLengthKm(start: ShootingAreaPoint, end: ShootingAreaPoint): number {
  return greatCircleDistanceKm(start.latitude, start.longitude, end.latitude, end.longitude);
}

export function pathPointAtFraction(
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  fraction: number
): { latitude: number; longitude: number } {
  const point = destinationPoint(start.latitude, start.longitude, bearingDegrees, lengthKm * fraction);
  return { latitude: point.latitude, longitude: point.longitude };
}

function evaluateFraction(
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number,
  fraction: number
): PathSample {
  const point = pathPointAtFraction(start, end, lengthKm, bearingDegrees, fraction);
  const distanceFromStartKm = lengthKm * fraction;
  const distanceToTargetKm = greatCircleDistanceKm(point.latitude, point.longitude, target.latitude, target.longitude);

  if (distanceToTargetKm * 1000 < NEAR_TARGET_METERS) {
    return {
      fraction,
      latitude: point.latitude,
      longitude: point.longitude,
      distanceFromStartKm,
      distanceToTargetKm,
      bearingToTarget: NaN,
      error: NaN,
      valid: false
    };
  }

  const bearingToTarget = initialBearing(point.latitude, point.longitude, target.latitude, target.longitude);
  return {
    fraction,
    latitude: point.latitude,
    longitude: point.longitude,
    distanceFromStartKm,
    distanceToTargetKm,
    bearingToTarget,
    error: angularDifference(bearingToTarget, azimuth),
    valid: true
  };
}

function bisectCrossing(
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number,
  fractionA: number,
  valueA: number,
  fractionB: number,
  _valueB: number,
  threshold: number
): number {
  let low = fractionA;
  let high = fractionB;
  let lowValue = valueA - threshold;

  for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration++) {
    const middle = (low + high) / 2;
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, middle);
    if (!sample.valid) {
      break;
    }
    const middleValue = sample.error - threshold;

    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function bisectSignedCrossing(
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number,
  fractionA: number,
  valueA: number,
  fractionB: number,
  _valueB: number
): number {
  let low = fractionA;
  let high = fractionB;
  let lowValue = valueA;

  for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration++) {
    const middle = (low + high) / 2;
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, middle);
    if (!sample.valid) {
      break;
    }
    const middleValue = signedBearingDelta(sample.bearingToTarget, azimuth);

    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}

function collectToleranceCrossings(
  samples: PathSample[],
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number,
  toleranceDegrees: number
): number[] {
  const crossings: number[] = [];
  const subSteps = 8;

  for (let index = 0; index < samples.length - 1; index++) {
    const sampleA = samples[index];
    const sampleB = samples[index + 1];
    if (!sampleA.valid || !sampleB.valid) {
      continue;
    }

    const span = sampleB.fraction - sampleA.fraction;
    for (let subIndex = 0; subIndex < subSteps; subIndex++) {
      const fractionA = sampleA.fraction + (span * subIndex) / subSteps;
      const fractionB = sampleA.fraction + (span * (subIndex + 1)) / subSteps;
      const valueA = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, fractionA).error;
      const valueB = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, fractionB).error;

      const diffA = valueA - toleranceDegrees;
      const diffB = valueB - toleranceDegrees;
      if (Math.abs(diffA) < EPSILON_DEGREES) {
        crossings.push(fractionA);
        continue;
      }
      if (Math.abs(diffB) < EPSILON_DEGREES) {
        crossings.push(fractionB);
        continue;
      }
      if (Math.sign(diffA) !== Math.sign(diffB)) {
        crossings.push(
          bisectCrossing(start, end, lengthKm, bearingDegrees, target, azimuth, fractionA, valueA, fractionB, valueB, toleranceDegrees)
        );
      }
    }
  }

  return crossings;
}

function collectZeroCrossings(
  samples: PathSample[],
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number
): number[] {
  const crossings: number[] = [];
  const subSteps = 8;

  for (let index = 0; index < samples.length - 1; index++) {
    const sampleA = samples[index];
    const sampleB = samples[index + 1];
    if (!sampleA.valid || !sampleB.valid) {
      continue;
    }

    const span = sampleB.fraction - sampleA.fraction;
    for (let subIndex = 0; subIndex < subSteps; subIndex++) {
      const fractionA = sampleA.fraction + (span * subIndex) / subSteps;
      const fractionB = sampleA.fraction + (span * (subIndex + 1)) / subSteps;
      const sampleValueA = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, fractionA);
      const sampleValueB = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, fractionB);
      if (!sampleValueA.valid || !sampleValueB.valid) {
        continue;
      }

      const valueA = signedBearingDelta(sampleValueA.bearingToTarget, azimuth);
      const valueB = signedBearingDelta(sampleValueB.bearingToTarget, azimuth);
      if (Math.abs(valueA - valueB) > 180) {
        continue;
      }
      if (Math.abs(valueA) < EPSILON_DEGREES) {
        crossings.push(fractionA);
        continue;
      }
      if (Math.abs(valueB) < EPSILON_DEGREES) {
        crossings.push(fractionB);
        continue;
      }
      if (Math.sign(valueA) !== Math.sign(valueB)) {
        crossings.push(
          bisectSignedCrossing(start, end, lengthKm, bearingDegrees, target, azimuth, fractionA, valueA, fractionB, valueB)
        );
      }
    }
  }

  return crossings;
}

function bestErrorSample(samples: PathSample[], zones: PathZone[]): PathSample | null {
  let best: PathSample | null = null;
  for (const sample of samples) {
    if (!sample.valid) {
      continue;
    }
    const inZone = zones.some(
      (zone) => sample.fraction >= zone.startFraction - EPSILON_DEGREES && sample.fraction <= zone.endFraction + EPSILON_DEGREES
    );
    if (!inZone) {
      continue;
    }
    if (!best || sample.error < best.error) {
      best = sample;
    }
  }
  return best;
}

function refineBest(
  start: ShootingAreaPoint,
  end: ShootingAreaPoint,
  lengthKm: number,
  bearingDegrees: number,
  target: GeographicPoint,
  azimuth: number,
  fraction: number
): number {
  const halfWindow = 4 / SEGMENTS;
  let low = Math.max(0, fraction - halfWindow);
  let high = Math.min(1, fraction + halfWindow);

  const evaluateError = (value: number) => {
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, value);
    return sample.valid ? sample.error : Infinity;
  };

  for (let iteration = 0; iteration < 40; iteration++) {
    const mid1 = low + (high - low) / 3;
    const mid2 = high - (high - low) / 3;
    if (evaluateError(mid1) < evaluateError(mid2)) {
      high = mid2;
    } else {
      low = mid1;
    }
  }

  return (low + high) / 2;
}

function toBestPosition(
  sample: PathSample,
  refinedFraction: number,
  refined: PathSample
): PathBestPosition {
  return {
    fraction: refinedFraction,
    latitude: refined.latitude,
    longitude: refined.longitude,
    distanceFromStartKm: refined.distanceFromStartKm,
    bearingToTarget: refined.bearingToTarget,
    alignmentError: refined.error
  };
}

export function solvePathPositions(input: SolvePathPositionsInput): PathPositionResult {
  const { start, end, target, azimuth, toleranceDegrees } = input;

  const lengthKm = pathTotalLengthKm(start, end);
  const bearingDegrees = initialBearing(start.latitude, start.longitude, end.latitude, end.longitude);

  if (!Number.isFinite(bearingDegrees) || lengthKm < 1e-9) {
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, 0);
    if (sample.valid && sample.error <= toleranceDegrees + EPSILON_DEGREES) {
      return {
        best: toBestPosition(sample, 0, sample),
        zones: [{ startFraction: 0, endFraction: 0, startDistanceKm: 0, endDistanceKm: 0 }]
      };
    }
    return { best: null, zones: [] };
  }

  const samples: PathSample[] = [];
  for (let index = 0; index <= SEGMENTS; index++) {
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, index / SEGMENTS);
    samples.push(sample);
  }

  if (toleranceDegrees >= 180) {
    let best: PathBestPosition | null = null;
    for (const sample of samples) {
      if (!sample.valid) {
        continue;
      }
      if (!best || sample.error < best.alignmentError) {
        best = toBestPosition(sample, sample.fraction, sample);
      }
    }
    return best
      ? { best, zones: [{ startFraction: 0, endFraction: 1, startDistanceKm: 0, endDistanceKm: lengthKm }] }
      : { best: null, zones: [] };
  }

  const crossings =
    toleranceDegrees === 0
      ? collectZeroCrossings(samples, start, end, lengthKm, bearingDegrees, target, azimuth)
      : collectToleranceCrossings(samples, start, end, lengthKm, bearingDegrees, target, azimuth, toleranceDegrees);
  const uniqueCrossings = Array.from(new Set(crossings.map((value) => Number(value.toFixed(9))))).sort(
    (a, b) => a - b
  );

  const boundaryPoints = [0, ...uniqueCrossings, 1];
  const zones: PathZone[] = [];

  for (let index = 0; index < boundaryPoints.length - 1; index++) {
    const intervalStart = boundaryPoints[index];
    const intervalEnd = boundaryPoints[index + 1];
    if (intervalEnd - intervalStart < EPSILON_DEGREES) {
      continue;
    }

    let mid = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, (intervalStart + intervalEnd) / 2);
    if (!mid.valid) {
      mid = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, 0.25 * intervalStart + 0.75 * intervalEnd);
    }
    if (!mid.valid) {
      mid = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, 0.75 * intervalStart + 0.25 * intervalEnd);
    }
    if (!mid.valid) {
      continue;
    }

    if (mid.error <= toleranceDegrees + EPSILON_DEGREES) {
      zones.push({
        startFraction: intervalStart,
        endFraction: intervalEnd,
        startDistanceKm: lengthKm * intervalStart,
        endDistanceKm: lengthKm * intervalEnd
      });
    }
  }

  if (toleranceDegrees === 0) {
    for (const crossing of uniqueCrossings) {
      const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, crossing);
      if (sample.valid && sample.error <= EPSILON_DEGREES) {
        zones.push({
          startFraction: crossing,
          endFraction: crossing,
          startDistanceKm: lengthKm * crossing,
          endDistanceKm: lengthKm * crossing
        });
      }
    }
  }

  const bestSample = bestErrorSample(samples, zones);
  let best: PathBestPosition | null = null;
  if (bestSample) {
    const refinedFraction = refineBest(start, end, lengthKm, bearingDegrees, target, azimuth, bestSample.fraction);
    const refined = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, refinedFraction);
    if (refined.valid) {
      best = toBestPosition(bestSample, refinedFraction, refined);
    } else {
      best = toBestPosition(bestSample, bestSample.fraction, bestSample);
    }
  } else if (zones.length > 0 && toleranceDegrees === 0) {
    const crossing = (zones[0].startFraction + zones[0].endFraction) / 2;
    const sample = evaluateFraction(start, end, lengthKm, bearingDegrees, target, azimuth, crossing);
    if (sample.valid) {
      best = toBestPosition(sample, crossing, sample);
    }
  }

  return { best, zones };
}
