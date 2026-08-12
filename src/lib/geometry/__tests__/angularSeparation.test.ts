import { angularDifference, angularSeparation } from '../angularSeparation';

describe('angularDifference', () => {
  it('returns 2 degrees for 359 vs 1', () => {
    expect(angularDifference(359, 1)).toBeCloseTo(2, 6);
  });

  it('returns 2 degrees for 1 vs 359', () => {
    expect(angularDifference(1, 359)).toBeCloseTo(2, 6);
  });

  it('returns 0 degrees for identical angles', () => {
    expect(angularDifference(90, 90)).toBeCloseTo(0, 6);
  });
});

describe('angularSeparation', () => {
  it('returns 0 for identical directions', () => {
    expect(angularSeparation({ azimuth: 90, altitude: 10 }, { azimuth: 90, altitude: 10 })).toBeCloseTo(0, 6);
  });

  it('returns expected separation for different directions', () => {
    const separation = angularSeparation(
      { azimuth: 0, altitude: 0 },
      { azimuth: 90, altitude: 0 }
    );
    expect(separation).toBeCloseTo(90, 6);
  });
});
