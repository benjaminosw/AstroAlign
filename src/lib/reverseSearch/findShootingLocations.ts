import type { ReverseSearchInput, ReverseSearchResult, ShootingLocation } from './types';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';
import { isValidIsoDate, isValidTolerance } from '../utils/searchUtils';
import { findRiseSetEvent } from '../astronomy/riseSet';
import { collectFullMoonInstants, isWithinFullMoonWindow } from '../astronomy/lunarPhase';
import { generateCandidates } from './generateCandidates';
import { scoreCandidate } from './scoreCandidate';
import { oppositeBearing } from '../geometry/bearing';

function assertValidRadius(radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error('Search radius must be a positive number');
  }
}

export async function findShootingLocations(input: ReverseSearchInput): Promise<ReverseSearchResult> {
  if (!isValidIsoDate(input.date)) {
    throw new Error('Date must be a valid ISO date');
  }

  if (!isValidTolerance(input.toleranceDegrees)) {
    throw new Error('Alignment tolerance must be a non-negative number');
  }

  assertValidRadius(input.searchRadiusKm);

  if (!input.timeZone) {
    throw new Error('Target timezone is required to interpret the local date');
  }

  const dayStartUtc = convertLocalTimeToUtc(input.date, '00:00:00', input.timeZone);
  const dayEndUtc = convertLocalTimeToUtc(input.date, '23:59:59', input.timeZone);

  const event = findRiseSetEvent(input.object, input.target, input.eventType, dayStartUtc, 2);
  if (!event) {
    throw new Error(
      `No valid ${input.eventType} event for the ${input.object} on ${input.date} at the target location.`
    );
  }

  const eventLocalDate = formatLocalDateTimeFromUtc(event.instant, input.timeZone).date;
  if (eventLocalDate !== input.date) {
    throw new Error(
      `No valid ${input.eventType} event for the ${input.object} on ${input.date} at the target location.`
    );
  }

  const fullMoonInstants =
    input.object === 'Moon'
      ? collectFullMoonInstants(dayStartUtc, dayEndUtc)
      : [];
  const withinFullMoonWindow = input.object === 'Moon' ? isWithinFullMoonWindow(event.instant, fullMoonInstants) : true;

  if (input.object === 'Moon' && input.fullMoonOnly && !withinFullMoonWindow) {
    throw new Error(
      `The ${input.object}${input.eventType} on ${input.date} is more than 24 hours from a Full Moon. No candidates.`
    );
  }

  const outboundBearing = oppositeBearing(event.azimuth);
  const candidatePoints = generateCandidates({
    target: input.target,
    eventAzimuth: event.azimuth,
    toleranceDegrees: input.toleranceDegrees,
    searchRadiusKm: input.searchRadiusKm,
    intervalMeters: input.candidateIntervalMeters,
    lateralSamples: input.lateralSamples
  });

  const candidates: ShootingLocation[] = [];
  const totalSteps = candidatePoints.length > 0 ? Math.ceil(candidatePoints.length / (input.lateralSamples ?? 5)) : 0;
  let completedSteps = 0;
  let lastYield = 0;

  for (const point of candidatePoints) {
    if (input.signal?.aborted) {
      throw new Error('Search canceled');
    }

    const score = scoreCandidate(input.target, { ...point, elevation: 0 }, event.azimuth, input.toleranceDegrees);

    if (!score.withinTolerance) {
      continue;
    }

    candidates.push({
      id: `candidate-${candidates.length}`,
      latitude: point.latitude,
      longitude: point.longitude,
      distanceKm: score.distanceKm,
      bearingToTarget: score.bearingToTarget,
      targetBearing: score.targetBearing,
      alignmentError: score.alignmentError,
      withinTolerance: score.withinTolerance,
      targetAltitude: score.targetAltitude
    });

    completedSteps++;
    if (input.onProgress) {
      input.onProgress(Math.min(completedSteps, totalSteps), Math.max(totalSteps, 1));
    }

    if (completedSteps - lastYield > 25) {
      lastYield = completedSteps;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const metadata = formatLocalDateTimeFromUtc(event.instant, input.timeZone);

  candidates.sort((a, b) => {
    if (a.alignmentError !== b.alignmentError) {
      return a.alignmentError - b.alignmentError;
    }
    return a.distanceKm - b.distanceKm;
  });

  return {
    event: {
      body: event.body,
      type: event.type,
      instant: event.instant,
      localDate: metadata.date,
      localTime: metadata.time,
      timeZoneLabel: metadata.timeZoneLabel,
      azimuth: event.azimuth,
      altitude: event.altitude,
      withinFullMoonWindow
    },
    idealTargetBearing: event.azimuth,
    idealOutboundBearing: outboundBearing,
    candidates
  };
}
