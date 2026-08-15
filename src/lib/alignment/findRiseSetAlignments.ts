import type { AlignmentCandidate, FindAlignmentsInput } from './types';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';
import { isValidIsoDate } from '../utils/searchUtils';
import { findRiseSetEvent } from '../astronomy/riseSet';
import { collectFullMoonInstants, getMoonPhase, isWithinFullMoonWindow } from '../astronomy/lunarPhase';
import { isTimeWithinWindow, resolveTimeWindow } from './timeFilter';
import { initialBearing } from '../geometry/bearing';
import { angularDifference } from '../geometry/angularSeparation';
import { greatCircleDistanceKm } from '../geometry/distance';
import { targetAltitude } from '../geometry/altitude';

const EVENT_TYPES: Array<'rise' | 'set'> = ['rise', 'set'];

function formatResultMetadata(date: Date, timeZone: string) {
  const parts = formatLocalDateTimeFromUtc(date, timeZone);
  return {
    localDate: parts.date,
    localTime: parts.time,
    timeZoneLabel: parts.timeZoneLabel
  };
}

function getEventLabel(object: FindAlignmentsInput['object'], eventType: 'rise' | 'set') {
  return `${object}${eventType === 'rise' ? 'rise' : 'set'}`;
}

export async function findRiseSetAlignments(input: FindAlignmentsInput): Promise<AlignmentCandidate[]> {
  if (!isValidIsoDate(input.startDate)) {
    throw new Error('Start date must be a valid ISO date');
  }

  if (!isValidIsoDate(input.endDate)) {
    throw new Error('End date must be a valid ISO date');
  }

  if (input.startDate > input.endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  const startDateUtc = convertLocalTimeToUtc(input.startDate, '00:00:00', input.timeZone);
  const endDateUtc = convertLocalTimeToUtc(input.endDate, '23:59:59', input.timeZone);
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
  const fullMoonInstants =
    input.object === 'Moon' && input.fullMoonOnly
      ? collectFullMoonInstants(startDateUtc, endDateUtc)
      : [];

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

    for (const eventType of EVENT_TYPES) {
      const event = findRiseSetEvent(input.object, input.observer, eventType, dayStartUtc, 2);
      if (!event) {
        continue;
      }
      const eventLocalDate = formatLocalDateTimeFromUtc(event.instant, input.timeZone).date;
      if (eventLocalDate !== dayLocalDate) {
        continue;
      }

      if (input.object === 'Moon' && input.fullMoonOnly && !isWithinFullMoonWindow(event.instant, fullMoonInstants)) {
        continue;
      }

      const azimuthError = angularDifference(targetAzimuth, event.azimuth);
      const metadata = formatResultMetadata(event.instant, input.timeZone);

      if (input.object === 'Moon') {
        const timeWindow = resolveTimeWindow({
          option: input.timeFilter ?? 'any',
          customStartTime: input.customStartTime,
          customEndTime: input.customEndTime
        });
        if (timeWindow && !isTimeWithinWindow(metadata.localTime, timeWindow)) {
          continue;
        }
      }

      const moonPhase = input.object === 'Moon' ? getMoonPhase(event.instant) : undefined;

      candidates.push({
        eventType,
        eventLabel: getEventLabel(input.object, eventType),
        localDate: metadata.localDate,
        localTime: metadata.localTime,
        timeZone: input.timeZone,
        timeZoneLabel: metadata.timeZoneLabel,
        score: azimuthError,
        moonPhase,
        moonIlluminationPercent: moonPhase?.illuminationPercent,
        moonDistanceKm: undefined,
        sunDistanceKm: undefined,
        object: {
          azimuth: event.azimuth,
          altitude: event.altitude
        },
        target: {
          distanceKm: targetDistanceKm,
          bearing: targetAzimuth,
          altitude: targetAlt
        },
        alignment: {
          angularSeparation: azimuthError,
          azimuthDelta: azimuthError,
          altitudeDelta: Math.abs(event.altitude - targetAlt),
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
