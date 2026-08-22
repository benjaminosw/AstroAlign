import { describe, expect, it } from 'vitest';
import { ASTRO_OBJECT } from '../../../types/astronomy';
import { buildCalendarEvent } from '../eventBuilder';
import {
  buildIcsFilename,
  escapeIcsText,
  foldContentLine,
  formatIcsUtc,
  generateIcs
} from '../ics';

const SINGAPORE = 'Asia/Singapore';

function moonDraft() {
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

describe('escapeIcsText', () => {
  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeIcsText('back\\slash')).toBe('back\\\\slash');
    expect(escapeIcsText('a;b')).toBe('a\\;b');
    expect(escapeIcsText('a,b')).toBe('a\\,b');
    expect(escapeIcsText('line1\nline2\r\nline3\rline4')).toBe('line1\\nline2\\nline3\\nline4');
  });
});

describe('foldContentLine', () => {
  it('folds long lines with CRLF + space and keeps short lines intact', () => {
    const short = 'SUMMARY:short';
    expect(foldContentLine(short)).toBe(short);

    const long = 'x'.repeat(200);
    const folded = foldContentLine(long);
    for (const line of folded.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    expect(folded.split('\r\n ').join('')).toBe(long);
  });

  it('never splits multi-byte emoji across lines', () => {
    const moon = '\u{1F315}'.repeat(40);
    const folded = foldContentLine(moon);
    expect(folded.replace(new RegExp('(\\r\\n )', 'g'), '')).toBe(moon);
    for (const segment of folded.split('\r\n')) {
      expect(Array.from(segment.replace(/^ /, '')).every((char) => char === '\u{1F315}')).toBe(true);
    }
  });
});

describe('formatIcsUtc', () => {
  it('formats UTC timestamps without shifting the absolute instant', () => {
    expect(formatIcsUtc(new Date('2026-08-29T11:42:18.000Z'))).toBe('20260829T114218Z');
  });
});

describe('generateIcs', () => {
  it('produces a valid RFC 5545 VCALENDAR/VEVENT structure', () => {
    const content = generateIcs([moonDraft()], new Date('2026-08-22T00:00:00Z'));
    const lines = content.trimEnd().split('\r\n');

    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((line) => line.startsWith('PRODID:'))).toBe(true);
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('END:VEVENT');
    // Singapore 19:42:18 local is 11:42:18 UTC — preserved exactly.
    expect(lines).toContain('DTSTART:20260829T114218Z');
    expect(lines).toContain('DTEND:20260829T114718Z');
    expect(lines).toContain('DTSTAMP:20260822T000000Z');
    expect(lines.some((line) => line.startsWith('UID:astroalign-') && line.endsWith('@astroalign.app'))).toBe(true);
    expect(lines.some((line) => line.startsWith('SUMMARY:') && line.includes('Full Moon'))).toBe(true);
    expect(lines.some((line) => line.startsWith('LOCATION:1.3127197\\, 103.8800259'))).toBe(true);
    expect(lines.some((line) => line.startsWith('DESCRIPTION:ASTROALIGN ALIGNMENT'))).toBe(true);

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('generates stable UIDs so re-importing updates instead of duplicating', () => {
    const first = generateIcs([moonDraft()]);
    const second = generateIcs([moonDraft()], new Date(Date.now() + 5000));
    const uidOf = (content: string) => content.match(/UID:(.*)\r\n/)?.[1];
    expect(uidOf(first)).toBe(uidOf(second));
  });

  it('emits one VEVENT per alignment for bulk export', () => {
    const sunDraft = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: 'rise',
      date: '2026-08-30',
      time: '07:01',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.3,
      targetName: 'Pier'
    });
    const content = generateIcs([moonDraft(), sunDraft]);
    expect(content.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(content.match(/END:VEVENT/g)?.length).toBe(2);
    expect(content).toContain('DTSTART:20260829T114218Z');
    // Singapore 30 Aug 07:01 local = 29 Aug 23:01 UTC (near-midnight rollover kept exact).
    expect(content).toContain('DTSTART:20260829T230100Z');
  });

  it('escapes special characters in the summary (non-ASCII and punctuation)', () => {
    const draft = buildCalendarEvent({
      object: ASTRO_OBJECT.Moon,
      event: null,
      date: '2026-09-01',
      time: '21:00',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.4,
      targetName: 'Caf\u00E9, "Rocks"; Bay \\ East',
      moonPhase: { name: 'Waxing Crescent', emoji: '\u{1F312}', phaseAngle: 45, illuminationPercent: 20 }
    });
    const content = generateIcs([draft]);
    const unfolded = content.replace(/\r\n /g, '');
    expect(unfolded).toContain('Waxing Crescent \u2014 Caf\u00E9\\, "Rocks"\\; Bay \\\\ East Alignment');
  });

  it('rejects empty event lists', () => {
    expect(() => generateIcs([])).toThrow();
  });
});

describe('buildIcsFilename', () => {
  it('uses the event filename base for single events', () => {
    expect(buildIcsFilename([moonDraft()])).toBe('AstroAlign_Lighthouse_Full_Moon_2026-08-29.ics');
  });

  it('summarises the visible date range for bulk events', () => {
    const second = buildCalendarEvent({
      object: ASTRO_OBJECT.Sun,
      event: 'set',
      date: '2026-09-02',
      time: '19:10',
      timeZone: SINGAPORE,
      alignmentErrorDegrees: 0.2,
      targetName: 'Pier'
    });
    expect(buildIcsFilename([moonDraft(), second])).toBe('AstroAlign_Alignments_2026-08-29_to_2026-09-02.ics');
    expect(buildIcsFilename([moonDraft(), moonDraft()])).toBe('AstroAlign_Alignments_2026-08-29.ics');
  });
});
