import { describe, expect, it } from 'vitest';
import { filterAlignmentResults } from '../filterResults';
import type { AlignmentCandidate } from '../types';
import type { MoonPhaseInfo } from '../../astronomy/lunarPhase';

const PHASES: Record<string, MoonPhaseInfo> = {
  'New Moon': { name: 'New Moon', emoji: '🌑', phaseAngle: 0, illuminationPercent: 0 },
  'Waxing Crescent': { name: 'Waxing Crescent', emoji: '🌒', phaseAngle: 45, illuminationPercent: 12 },
  'First Quarter': { name: 'First Quarter', emoji: '🌓', phaseAngle: 90, illuminationPercent: 50 },
  'Waxing Gibbous': { name: 'Waxing Gibbous', emoji: '🌔', phaseAngle: 135, illuminationPercent: 75 },
  'Full Moon': { name: 'Full Moon', emoji: '🌕', phaseAngle: 180, illuminationPercent: 100 },
  'Waning Gibbous': { name: 'Waning Gibbous', emoji: '🌖', phaseAngle: 225, illuminationPercent: 75 },
  'Last Quarter': { name: 'Last Quarter', emoji: '🌗', phaseAngle: 270, illuminationPercent: 50 },
  'Waning Crescent': { name: 'Waning Crescent', emoji: '🌘', phaseAngle: 315, illuminationPercent: 12 }
};

function candidate(
  phaseName: string | null,
  localTime: string,
  overrides: Partial<AlignmentCandidate> = {}
): AlignmentCandidate {
  return {
    utcInstant: `2025-09-20T${localTime}:00.000Z`,
    eventType: 'rise',
    eventLabel: 'Moonrise',
    localDate: '2025-09-20',
    localTime,
    timeZone: 'Asia/Singapore',
    timeZoneLabel: 'SGT',
    score: 0.5,
    moonPhase: phaseName ? PHASES[phaseName] : undefined,
    object: { azimuth: 77, altitude: 0 },
    target: { bearing: 76, distanceKm: 10, altitude: 0 },
    alignment: { angularSeparation: 0.5, azimuthDelta: 0.5, altitudeDelta: 0, withinTolerance: true },
    ...overrides
  };
}

const candidates = [
  candidate('Full Moon', '19:00:00'),
  candidate('Waxing Gibbous', '20:30:00'),
  candidate('Waxing Gibbous', '12:00:00'),
  candidate('New Moon', '23:00:00'),
  candidate('Waning Crescent', '05:30:00'),
  candidate('Waning Gibbous', '14:00:00')
];

describe('filterAlignmentResults', () => {
  it('returns all candidates when no phase filter is applied and time is any', () => {
    const result = filterAlignmentResults(candidates, { moonPhases: null, timeFilter: 'any' });
    expect(result).toHaveLength(candidates.length);
  });

  it('does not mutate the input candidates', () => {
    const input = [...candidates];
    filterAlignmentResults(input, { moonPhases: ['Full Moon'], timeFilter: 'any' });
    expect(input).toHaveLength(candidates.length);
  });

  it('filters to a single phase', () => {
    const result = filterAlignmentResults(candidates, { moonPhases: ['Full Moon'], timeFilter: 'any' });
    expect(result.map((item) => item.moonPhase?.name)).toEqual(['Full Moon']);
  });

  it('combines multiple phases with OR semantics', () => {
    const result = filterAlignmentResults(candidates, {
      moonPhases: ['Waxing Gibbous', 'New Moon'],
      timeFilter: 'any'
    });
    expect(result.map((item) => item.moonPhase?.name).sort()).toEqual(['New Moon', 'Waxing Gibbous', 'Waxing Gibbous']);
  });

  it('returns an empty list when the selected phase set is empty', () => {
    const result = filterAlignmentResults(candidates, { moonPhases: [], timeFilter: 'any' });
    expect(result).toHaveLength(0);
  });

  it('filters Moon candidates by the night time window', () => {
    const result = filterAlignmentResults(candidates, { moonPhases: null, timeFilter: 'night' });
    expect(result.map((item) => item.localTime)).toEqual(['19:00:00', '20:30:00', '23:00:00', '05:30:00']);
  });

  it('filters by a custom crossing-midnight window', () => {
    const result = filterAlignmentResults(candidates, {
      moonPhases: null,
      timeFilter: 'custom',
      customStartTime: '20:00',
      customEndTime: '04:00'
    });
    expect(result.map((item) => item.localTime)).toEqual(['20:30:00', '23:00:00']);
  });

  it('combines phase and time filters with AND semantics', () => {
    const result = filterAlignmentResults(candidates, {
      moonPhases: ['Waxing Gibbous', 'Full Moon'],
      timeFilter: 'night'
    });
    expect(result.map((item) => item.moonPhase?.name)).toEqual(['Full Moon', 'Waxing Gibbous']);
  });

  it('leaves candidates without phase info unaffected when no phase filter is applied', () => {
    const sunCandidates = [candidate(null, '12:00:00'), candidate(null, '06:30:00')];
    const result = filterAlignmentResults(sunCandidates, { moonPhases: null, timeFilter: 'night' });
    expect(result).toHaveLength(2);
  });

  it('does not filter candidates that carry no phase information', () => {
    const mixed = [candidate('Full Moon', '19:00:00'), candidate(null, '12:00:00')];
    const result = filterAlignmentResults(mixed, { moonPhases: ['Full Moon'], timeFilter: 'any' });
    expect(result).toHaveLength(2);
  });
});
