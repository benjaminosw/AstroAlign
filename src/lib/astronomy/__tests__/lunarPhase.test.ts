import { describe, expect, it } from 'vitest';
import { getMoonPhase, moonPhaseBucket } from '../lunarPhase';

describe('moonPhaseBucket', () => {
  it('maps the eight traditional phases at 22.5° boundaries', () => {
    expect(moonPhaseBucket(0).name).toBe('New Moon');
    expect(moonPhaseBucket(0).emoji).toBe('🌑');
    expect(moonPhaseBucket(60).name).toBe('Waxing Crescent');
    expect(moonPhaseBucket(90).name).toBe('First Quarter');
    expect(moonPhaseBucket(135).name).toBe('Waxing Gibbous');
    expect(moonPhaseBucket(180).name).toBe('Full Moon');
    expect(moonPhaseBucket(180).emoji).toBe('🌕');
    expect(moonPhaseBucket(225).name).toBe('Waning Gibbous');
    expect(moonPhaseBucket(270).name).toBe('Last Quarter');
    expect(moonPhaseBucket(315).name).toBe('Waning Crescent');
  });

  it('wraps phase angles outside 0..360 and around the 0/360 seam', () => {
    expect(moonPhaseBucket(-30).name).toBe('Waning Crescent');
    expect(moonPhaseBucket(350).name).toBe('New Moon');
    expect(moonPhaseBucket(337).name).toBe('Waning Crescent');
    expect(moonPhaseBucket(392).name).toBe('Waxing Crescent');
  });
});

describe('getMoonPhase', () => {
  it('reports the full moon phase and illumination for a known full moon', () => {
    const phase = getMoonPhase(new Date('2025-09-07T00:00:00Z'));
    expect(phase.name).toBe('Full Moon');
    expect(phase.emoji).toBe('🌕');
    expect(phase.illuminationPercent).toBeGreaterThan(90);
  });

  it('reports the new moon phase for a known new moon', () => {
    const phase = getMoonPhase(new Date('2025-09-22T00:00:00Z'));
    expect(phase.name).toBe('New Moon');
    expect(phase.illuminationPercent).toBeLessThan(1);
  });

  it('reports a waxing crescent for a verified intermediate angle', () => {
    const phase = getMoonPhase(new Date('2026-08-17T11:42:18Z'));
    expect(phase.name).toBe('Waxing Crescent');
    expect(phase.phaseAngle).toBeGreaterThan(0);
    expect(phase.phaseAngle).toBeLessThan(360);
  });
});
