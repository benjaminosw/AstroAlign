import { initialBearing } from '../bearing';

describe('initialBearing', () => {
  it('returns north when target is directly north', () => {
    expect(initialBearing(0, 0, 1, 0)).toBeCloseTo(0, 6);
  });

  it('returns east when target is directly east', () => {
    expect(initialBearing(0, 0, 0, 1)).toBeCloseTo(90, 6);
  });

  it('returns south when target is directly south', () => {
    expect(initialBearing(0, 0, -1, 0)).toBeCloseTo(180, 6);
  });

  it('returns west when target is directly west', () => {
    expect(initialBearing(0, 0, 0, -1)).toBeCloseTo(270, 6);
  });

  it('handles longitude wrap-around near north correctly', () => {
    expect(initialBearing(0, 0, 1, -0.01)).toBeGreaterThan(358);
    expect(initialBearing(0, 0, 1, 0.01)).toBeLessThan(2);
  });
});
