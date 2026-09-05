import type { AlignmentCandidate, FindAlignmentsInput } from './types';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';
import { isValidIsoDate } from '../utils/searchUtils';
import { findAltitudeCrossings } from '../astronomy/altitudeCrossing';
import { getMoonPhase } from '../astronomy/lunarPhase';
import { initialBearing } from '../geometry/bearing';
import { angularDifference } from '../geometry/angularSeparation';
import { greatCircleDistanceKm } from '../geometry/distance';
import { targetAltitude } from '../geometry/altitude';

function getEventLabel(object: FindAlignmentsInput['object'], direction: 'rise' | 'set') {
  return `${object}${direction === 'rise' ? 'rise' : 'set'}`;
}

export async function findAltitudeAlignments(input: FindAlignmentsInput): Promise<AlignmentCandidate[]> {
  if (!isValidIsoDate(input.startDate)) {
    throw new Error('Start date must be a valid ISO date');
  }

  if (!isValidIsoDate(input.endDate)) {
    throw new Error('End date must be a valid ISO date');
  }

  if (input.startDate > input.endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  const targetAzimuth = initialBearing(
    input.observer.latitude,
    input.observer.longitude,
    input.target.latitude,
    input.target.longitude
  );

  const targetDistanceKm = greatCircleDistanceKm(
    input.observer.latitude,
    input.observer.longitude,
    input.target.latitude,
    input.target.longitude
  );

  const targetAlt = targetAltitude(input.observer, input.target, targetDistanceKm);

  const candidates: AlignmentCandidate[] = [];
  const startLocalDate = new Date(`${input.startDate}T00:00:00Z`);
  const endLocalDate = new Date(`${input.endDate}T00:00:00Z`);
  const totalDays = Math.floor((endLocalDate.getTime() - startLocalDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    if (input.signal?.aborted) {
      throw new Error('Search canceled');
    }

    const dayLocalDate = new Date(startLocalDate.getTime() + dayIndex * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const dayStartUtc = convertLocalTimeToUtc(dayLocalDate, '00:00:00', input.timeZone);
    const dayEndUtc = convertLocalTimeToUtc(dayLocalDate, '23:59:59', input.timeZone);

    const crossings = findAltitudeCrossings(input.object, input.observer, targetAlt, dayStartUtc, dayEndUtc);

    for (const crossing of crossings) {
      const azimuthError = angularDifference(targetAzimuth, crossing.azimuth);
      const metadata = formatLocalDateTimeFromUtc(crossing.time, input.timeZone);
      if (metadata.date !== dayLocalDate) {
        continue;
      }

      const moonPhase = input.object === 'Moon' ? getMoonPhase(crossing.time) : undefined;

      candidates.push({
        utcInstant: crossing.time.toISOString(),
        eventType: crossing.direction,
        eventLabel: getEventLabel(input.object, crossing.direction),
        localDate: metadata.date,
        localTime: metadata.time,
        timeZone: input.timeZone,
        timeZoneLabel: metadata.timeZoneLabel,
        score: azimuthError,
        moonPhase,
        moonIlluminationPercent: moonPhase?.illuminationPercent,
        moonDistanceKm: undefined,
        sunDistanceKm: undefined,
        object: {
          azimuth: crossing.azimuth,
          altitude: crossing.altitude
        },
        target: {
          distanceKm: targetDistanceKm,
          bearing: targetAzimuth,
          altitude: targetAlt
        },
        alignment: {
          angularSeparation: azimuthError,
          azimuthDelta: azimuthError,
          altitudeDelta: Math.abs(crossing.altitude - targetAlt),
          withinTolerance: azimuthError <= input.toleranceDegrees
        }
      });
    }

    if (input.onProgress) {
      input.onProgress(dayIndex + 1, totalDays);
    }

    if (dayIndex % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return candidates.sort((a, b) => {
    const dateCompare = a.localDate.localeCompare(b.localDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.localTime.localeCompare(b.localTime);
  });
}
