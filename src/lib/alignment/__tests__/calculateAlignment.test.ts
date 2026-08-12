import { calculateAlignment } from '../calculateAlignment';
import { AstroObject } from '../../../types/astronomy';

describe('calculateAlignment', () => {
  const input = {
    observer: { latitude: 37.7749, longitude: -122.4194, elevation: 0 },
    target: { latitude: 37.8199, longitude: -122.4783, elevation: 0 },
    object: AstroObject.Sun,
    date: '2025-09-22',
    time: '12:00',
    timeZone: 'America/Los_Angeles',
    toleranceDegrees: 0.5
  };

  it('returns an alignment result with expected properties', () => {
    const result = calculateAlignment(input);
    expect(result.object.azimuth).toBeGreaterThanOrEqual(0);
    expect(result.object.altitude).toBeGreaterThanOrEqual(-90);
    expect(result.object.altitude).toBeLessThanOrEqual(90);
    expect(result.target.distanceKm).toBeGreaterThan(0);
    expect(result.target.bearing).toBeGreaterThanOrEqual(0);
    expect(result.target.bearing).toBeLessThan(360);
    expect(result.alignment.angularSeparation).toBeGreaterThanOrEqual(0);
  });

  it('throws when latitude is invalid', () => {
    expect(() =>
      calculateAlignment({
        ...input,
        observer: { ...input.observer, latitude: 100 }
      })
    ).toThrow(/latitude/);
  });

  it('throws when longitude is invalid', () => {
    expect(() =>
      calculateAlignment({
        ...input,
        target: { ...input.target, longitude: 200 }
      })
    ).toThrow(/longitude/);
  });

  it('throws when date is invalid', () => {
    expect(() =>
      calculateAlignment({
        ...input,
        date: 'invalid-date'
      })
    ).toThrow(/Date/);
  });

  it('throws when time is invalid', () => {
    expect(() =>
      calculateAlignment({
        ...input,
        time: '24:00'
      })
    ).toThrow(/Time/);
  });
});
