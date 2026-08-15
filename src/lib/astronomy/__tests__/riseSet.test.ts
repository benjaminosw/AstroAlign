import { describe, expect, it } from 'vitest';
import { findRiseSetLocalTimes } from '../riseSet';
import { DEFAULT_OBSERVER } from '../../constants/defaultCoordinates';

describe('findRiseSetLocalTimes', () => {
  it('returns sunrise and sunset times on the selected local date', () => {
    const times = findRiseSetLocalTimes('Sun', DEFAULT_OBSERVER, '2025-09-20', 'Asia/Singapore');

    expect(times.rise).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(times.set).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);

    const riseHour = Number(times.rise?.slice(0, 2));
    const setHour = Number(times.set?.slice(0, 2));
    expect(riseHour).toBeGreaterThanOrEqual(5);
    expect(riseHour).toBeLessThanOrEqual(8);
    expect(setHour).toBeGreaterThanOrEqual(18);
    expect(setHour).toBeLessThanOrEqual(20);
  });

  it('returns both moonrise and moonset times for the Moon', () => {
    const times = findRiseSetLocalTimes('Moon', DEFAULT_OBSERVER, '2025-09-20', 'Asia/Singapore');

    expect(times.rise).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(times.set).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
