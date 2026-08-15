import type { FindShootingOpportunitiesInput, ShootingOpportunity, ShootingSolution } from './types';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';
import { isValidIsoDate, isValidTolerance } from '../utils/searchUtils';
import { findRiseSetEvent, type RiseSetEvent } from '../astronomy/riseSet';
import { getMoonPhase } from '../astronomy/lunarPhase';
import { solveAreaShootingPositions } from './areaSolver';

function eventLabelOf(object: FindShootingOpportunitiesInput['object'], eventType: 'rise' | 'set') {
  return `${object}${eventType === 'rise' ? 'rise' : 'set'}`;
}

function assertValidArea(input: FindShootingOpportunitiesInput) {
  const points = input.area.type === 'path' ? [input.area.start, input.area.end] : input.area.points;

  if (input.area.type === 'points' && points.length === 0) {
    throw new Error('At least one shooting point is required');
  }

  for (const point of points) {
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      throw new Error('Shooting area points must contain valid coordinates');
    }
  }
}

function buildOpportunity(
  input: FindShootingOpportunitiesInput,
  event: RiseSetEvent,
  solution: ShootingSolution,
  index: number
): ShootingOpportunity {
  const metadata = formatLocalDateTimeFromUtc(event.instant, input.timeZone);
  const moonPhase = input.object === 'Moon' ? getMoonPhase(event.instant) : undefined;

  return {
    id: `${metadata.date}-${eventLabelOf(input.object, event.type)}-${index}-${solution.source === 'point' ? (solution.pointId ?? 'p') : 'path'}`,
    utcInstant: event.instant.toISOString(),
    eventType: event.type,
    eventLabel: eventLabelOf(input.object, event.type),
    localDate: metadata.date,
    localTime: metadata.time,
    timeZone: input.timeZone,
    timeZoneLabel: metadata.timeZoneLabel,
    object: input.object,
    objectAzimuth: event.azimuth,
    objectAltitude: event.altitude,
    moonPhase,
    moonIlluminationPercent: moonPhase?.illuminationPercent,
    position: solution,
    score: solution.alignmentError
  };
}

export async function findShootingOpportunities(
  input: FindShootingOpportunitiesInput
): Promise<ShootingOpportunity[]> {
  if (!isValidIsoDate(input.startDate)) {
    throw new Error('Start date must be a valid ISO date');
  }

  if (!isValidIsoDate(input.endDate)) {
    throw new Error('End date must be a valid ISO date');
  }

  if (input.startDate > input.endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  if (!isValidTolerance(input.toleranceDegrees)) {
    throw new Error('Alignment tolerance must be a non-negative number');
  }

  if (!input.timeZone) {
    throw new Error('Target timezone is required to interpret the local date range');
  }

  assertValidArea(input);

  const opportunities: ShootingOpportunity[] = [];
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

    const event = findRiseSetEvent(input.object, input.target, input.eventType, dayStartUtc, 2);
    if (!event) {
      if (input.onProgress) {
        input.onProgress(dayIndex + 1, totalDays);
      }
      continue;
    }

    const eventLocalDate = formatLocalDateTimeFromUtc(event.instant, input.timeZone).date;
    if (eventLocalDate !== dayLocalDate) {
      if (input.onProgress) {
        input.onProgress(dayIndex + 1, totalDays);
      }
      continue;
    }

    const areaResult = solveAreaShootingPositions({
      area: input.area,
      target: input.target,
      azimuth: event.azimuth,
      toleranceDegrees: input.toleranceDegrees
    });

    for (const solution of areaResult.solutions) {
      opportunities.push(buildOpportunity(input, event, solution, opportunities.length));
    }

    if (input.onProgress) {
      input.onProgress(dayIndex + 1, totalDays);
    }

    if (dayIndex % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return opportunities.sort((a, b) => {
    const dateCompare = a.localDate.localeCompare(b.localDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    const timeCompare = a.localTime.localeCompare(b.localTime);
    if (timeCompare !== 0) {
      return timeCompare;
    }
    return a.score - b.score;
  });
}
