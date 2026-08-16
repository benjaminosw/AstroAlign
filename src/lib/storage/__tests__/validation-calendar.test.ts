import { describe, expect, it } from 'vitest';
import { validateCalendarIntegrations } from '../validation';

describe('validateCalendarIntegrations', () => {
  it('accepts null, undefined, and empty records', () => {
    expect(validateCalendarIntegrations(null)).toBeNull();
    expect(validateCalendarIntegrations(undefined)).toBeNull();
    expect(validateCalendarIntegrations({})).toBeNull();
  });

  it('accepts a valid entry for each provider', () => {
    const value = {
      google: { calendarId: 'primary', eventId: 'evt-1', eventUrl: 'https://calendar.google.com/e', lastSyncedAt: '2027-08-01T00:00:00.000Z' },
      microsoft: { calendarId: 'cal-2', eventId: 'evt-2', eventUrl: null, lastSyncedAt: '2027-08-01T00:00:00.000Z' }
    };
    expect(validateCalendarIntegrations(value)).toBeNull();
  });

  it('rejects non-object records', () => {
    expect(validateCalendarIntegrations('nope')).toBe('must be an object');
    expect(validateCalendarIntegrations([{}])).toBe('must be an object');
  });

  it('rejects a missing calendarId', () => {
    expect(
      validateCalendarIntegrations({ google: { calendarId: '', eventId: 'e', eventUrl: null, lastSyncedAt: '2027-08-01T00:00:00.000Z' } })
    ).toBe('google integration calendarId must be a non-empty string');
  });

  it('rejects a missing eventId', () => {
    expect(
      validateCalendarIntegrations({ microsoft: { calendarId: 'c', eventId: '', eventUrl: null, lastSyncedAt: '2027-08-01T00:00:00.000Z' } })
    ).toBe('microsoft integration eventId must be a non-empty string');
  });

  it('rejects a non-string eventUrl', () => {
    expect(
      validateCalendarIntegrations({ google: { calendarId: 'c', eventId: 'e', eventUrl: 42, lastSyncedAt: '2027-08-01T00:00:00.000Z' } })
    ).toBe('google integration eventUrl must be a string or null');
  });

  it('rejects an invalid lastSyncedAt', () => {
    expect(
      validateCalendarIntegrations({ google: { calendarId: 'c', eventId: 'e', eventUrl: null, lastSyncedAt: 'yesterday' } })
    ).toBe('google integration lastSyncedAt must be a valid ISO date');
  });

  it('rejects a non-object entry', () => {
    expect(validateCalendarIntegrations({ google: 'garbage' })).toBe('google integration must be an object');
  });
});
