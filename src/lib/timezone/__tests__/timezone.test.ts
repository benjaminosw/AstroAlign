import { describe, expect, it } from 'vitest';
import { getTimezoneFromCoordinates } from '../getTimezoneFromCoordinates';
import { convertLocalTimeToUtc } from '../convertLocalTimeToUtc';

describe('timezone utilities', () => {
  it('returns Asia/Singapore for Singapore coordinates', () => {
    const result = getTimezoneFromCoordinates(1.3127197143335354, 103.88002586269513);
    expect(result.timeZone).toBe('Asia/Singapore');
  });

  it('returns America/New_York for New York coordinates', () => {
    const result = getTimezoneFromCoordinates(40.7128, -74.0060);
    expect(result.timeZone).toBe('America/New_York');
  });

  it('returns Europe/London for London coordinates', () => {
    const result = getTimezoneFromCoordinates(51.5074, -0.1278);
    expect(result.timeZone).toBe('Europe/London');
  });

  it('converts local Singapore time to different UTC instants than New York', () => {
    const singaporeUtc = convertLocalTimeToUtc('2026-08-12', '19:00', 'Asia/Singapore');
    const newYorkUtc = convertLocalTimeToUtc('2026-08-12', '19:00', 'America/New_York');

    expect(singaporeUtc.toISOString()).toBe('2026-08-12T11:00:00.000Z');
    expect(newYorkUtc.toISOString()).toBe('2026-08-12T23:00:00.000Z');
    expect(singaporeUtc.getTime()).not.toBe(newYorkUtc.getTime());
  });

  it('handles DST correctly for New York in summer', () => {
    const result = getTimezoneFromCoordinates(40.7128, -74.0060);
    const utc = convertLocalTimeToUtc('2026-07-01', '12:00', result.timeZone);
    expect(utc.toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });

  it('throws for invalid coordinates', () => {
    expect(() => getTimezoneFromCoordinates(95, 200)).toThrow();
  });
});
