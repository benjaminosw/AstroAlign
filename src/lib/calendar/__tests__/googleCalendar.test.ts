import { describe, expect, it } from 'vitest';
import { ASTRO_OBJECT } from '../../../types/astronomy';
import { buildCalendarEvent } from '../eventBuilder';
import { buildGoogleCalendarUrl, formatCompactUtc } from '../googleCalendar';

const SINGAPORE = 'Asia/Singapore';

function singaporeMoonDraft() {
  return buildCalendarEvent({
    object: ASTRO_OBJECT.Moon,
    event: 'rise',
    date: '2026-08-29',
    time: '19:42:18',
    timeZone: SINGAPORE,
    alignmentErrorDegrees: 0.12,
    moonPhase: { name: 'Full Moon', emoji: '\u{1F315}', phaseAngle: 180, illuminationPercent: 99.8 },
    targetName: 'Lighthouse',
    shootingPosition: { latitude: 1.3127197, longitude: 103.8800259, bearingToTarget: 123.4 }
  });
}

describe('formatCompactUtc', () => {
  it('formats UTC compact timestamps with seconds', () => {
    expect(formatCompactUtc(new Date('2026-08-29T11:42:18.000Z'))).toBe('20260829T114218Z');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('creates a template URL (no API, no OAuth) with exact UTC times', () => {
    const url = buildGoogleCalendarUrl(singaporeMoonDraft());
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('\u{1F315} Full Moon \u2014 Lighthouse Alignment');
    expect(parsed.searchParams.get('dates')).toBe('20260829T114218Z/20260829T114718Z');
    expect(parsed.searchParams.get('ctz')).toBe(SINGAPORE);
    expect(parsed.searchParams.get('location')).toBe('1.3127197, 103.8800259');
    expect(parsed.searchParams.get('details')).toContain('ASTROALIGN ALIGNMENT');
    expect(url).not.toMatch(/client_id|client_secret|oauth|api[_-]?key/i);
  });

  it('keeps seconds precision and encodes multi-line descriptions safely', () => {
    const draft = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: null,
      date: '2026-01-01',
      time: '00:05',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.2
    });
    const parsed = new URL(buildGoogleCalendarUrl(draft));

    expect(parsed.searchParams.get('dates')).toBe('20251231T160500Z/20251231T161000Z');
    expect(parsed.searchParams.get('details')).toContain('\n');
  });

  it('omits the location parameter when no location exists', () => {
    const draft = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: null,
      date: '2026-06-01',
      time: '12:00',
      timeZone: 'Europe/London',
      alignmentErrorDegrees: 0.5
    });
    expect(new URL(buildGoogleCalendarUrl(draft)).searchParams.has('location')).toBe(false);
  });
});
