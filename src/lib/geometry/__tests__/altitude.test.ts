import { targetAltitude } from '../altitude';

describe('targetAltitude', () => {
  it('returns 0 when observer and target are same elevation and location', () => {
    expect(targetAltitude({ elevation: 100 }, { elevation: 100 }, 0)).toBe(0);
  });

  it('returns positive altitude when target is higher than observer', () => {
    const alt = targetAltitude({ elevation: 0 }, { elevation: 100 }, 1);
    expect(alt).toBeGreaterThan(0);
  });

  it('returns negative altitude when target is lower than observer', () => {
    const alt = targetAltitude({ elevation: 100 }, { elevation: 0 }, 1);
    expect(alt).toBeLessThan(0);
  });
});
