import { findAlignments } from '../findAlignments';
import { ASTRO_OBJECT } from '../../../types/astronomy';

describe('findAlignments', () => {
  const observer = { latitude: 37.7749, longitude: -122.4194, elevation: 0 };
  const target = { latitude: 37.7749, longitude: -122.0, elevation: 0 };

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
});