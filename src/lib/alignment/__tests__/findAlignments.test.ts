import { findAlignments } from '../findAlignments';
import { isTimeWithinWindow } from '../timeFilter';
import { ASTRO_OBJECT } from '../../../types/astronomy';

describe('findAlignments', () => {
  const observer = { latitude: 37.7749, longitude: -122.4194, elevation: 0 };
  const target = { latitude: 37.7749, longitude: -122.0, elevation: 0 };
  const moonRange = {
    observer,
    target,
    object: ASTRO_OBJECT.Moon,
    startDate: '2025-09-20',
    endDate: '2025-09-22',
    toleranceDegrees: 10,
    timeZone: 'America/Los_Angeles'
  };

  it('returns alignment candidates within the requested date range', async () => {
    const results = await findAlignments({
      observer,
      target,
      object: ASTRO_OBJECT.Sun,
      startDate: '2025-09-22',
      endDate: '2025-09-22',
      toleranceDegrees: 10,
      timeZone: 'America/Los_Angeles'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((candidate) => candidate.localDate === '2025-09-22')).toBe(true);
  });

  it('returns rise/set event candidates with azimuth-based matching only', async () => {
    const results = await findAlignments({
      observer,
      target,
      object: ASTRO_OBJECT.Sun,
      startDate: '2025-09-22',
      endDate: '2025-09-22',
      toleranceDegrees: 10,
      timeZone: 'America/Los_Angeles'
    });

    expect(results.every((candidate) => ['rise', 'set'].includes(candidate.eventType))).toBe(true);
  });

  it('adds moon phase information to Moon candidates only', async () => {
    const moonResults = await findAlignments(moonRange);
    expect(moonResults.length).toBeGreaterThan(0);
    expect(moonResults.every((candidate) => candidate.moonPhase?.name && candidate.moonPhase.emoji)).toBe(true);

    const sunResults = await findAlignments({
      ...moonRange,
      object: ASTRO_OBJECT.Sun,
      startDate: '2025-09-20',
      endDate: '2025-09-20'
    });
    expect(sunResults.every((candidate) => candidate.moonPhase === undefined)).toBe(true);
  });

  it('keeps the full moon phase on an event near a known full moon', async () => {
    const results = await findAlignments({
      observer,
      target,
      object: ASTRO_OBJECT.Moon,
      startDate: '2025-09-07',
      endDate: '2025-09-07',
      toleranceDegrees: 10,
      timeZone: 'America/Los_Angeles'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((candidate) => candidate.moonPhase?.name === 'Full Moon')).toBe(true);
  });

  it('calculates the complete candidate set so result filters can be applied afterwards', async () => {
    const results = await findAlignments(moonRange);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((candidate) => candidate.utcInstant)).toBe(true);

    const hasNightEvent = results.some((candidate) =>
      isTimeWithinWindow(candidate.localTime, { start: '18:00', end: '07:00' })
    );
    const hasDaytimeEvent = results.some((candidate) =>
      !isTimeWithinWindow(candidate.localTime, { start: '18:00', end: '07:00' })
    );

    expect(hasNightEvent).toBe(true);
    expect(hasDaytimeEvent).toBe(true);
  });
});