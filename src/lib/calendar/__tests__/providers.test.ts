import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedAlignment } from '../../saved/types';
import { CalendarApiError } from '../http';
import { GoogleCalendarProvider, MicrosoftCalendarProvider, googleClientEventId } from '../providers';

function makeAlignment(overrides: Partial<SavedAlignment> = {}): SavedAlignment {
  return {
    id: 'align-1',
    name: 'Sunrise 2027',
    dedupeKey: 'finder|Sun|rise|2027-08-01|07:00:00|90.000',
    source: 'finder',
    object: 'Sun',
    event: 'rise',
    date: '2027-08-01',
    time: '07:00:00',
    timeZone: 'UTC',
    celestialAzimuth: 90,
    targetBearing: 89.5,
    alignmentError: 0.5,
    toleranceDegrees: 1,
    withinTolerance: true,
    moonPhase: null,
    observerSnapshot: null,
    targetSnapshot: null,
    shootingPositionSnapshot: null,
    shootingLocationSnapshot: null,
    createdAt: '2027-08-01T00:00:00.000Z',
    updatedAt: '2027-08-01T00:00:00.000Z',
    ...overrides
  };
}

type FetchCall = { url: string; init?: Parameters<typeof fetch>[1] };

let calls: FetchCall[];
let handler: (_url: string, _init?: Parameters<typeof fetch>[1]) => Response;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('calendar providers', () => {
  beforeEach(() => {
    calls = [];
    handler = () => jsonResponse({});
    const fetchMock = vi.fn(async (input: string | URL, init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, init });
      return handler(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('googleClientEventId', () => {
    it('is deterministic for the same alignment', () => {
      const first = googleClientEventId(makeAlignment());
      const second = googleClientEventId(makeAlignment());
      expect(first).toBe(second);
    });

    it('differs for different alignments', () => {
      const first = googleClientEventId(makeAlignment({ id: 'align-1' }));
      const second = googleClientEventId(makeAlignment({ id: 'align-2', dedupeKey: 'finder|Sun|rise|2027-08-02|07:00:00|90.000' }));
      expect(first).not.toBe(second);
    });

    it('satisfies the Google base32hex id restrictions', () => {
      const alignment = makeAlignment({ dedupeKey: 'finder|Sun Moon|rise|2027-08-01|07:00:00|90.000' });
      const id = googleClientEventId(alignment);
      expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    });
  });

  it('GoogleCalendarProvider.listCalendars requests the calendars route', async () => {
    handler = () => jsonResponse({ calendars: [{ id: 'primary', summary: 'Primary' }] });
    const provider = new GoogleCalendarProvider();
    const calendars = await provider.listCalendars();

    expect(calendars).toEqual([{ id: 'primary', summary: 'Primary' }]);
    expect(calls[0].url).toBe('/api/calendar/google/calendars');
  });

  it('GoogleCalendarProvider.createEvent posts a create request with the client event id', async () => {
    handler = () => jsonResponse({ eventId: 'event-1', eventUrl: 'https://calendar.google.com/event?eid=1' });
    const provider = new GoogleCalendarProvider();
    const result = await provider.createEvent({
      calendarId: 'primary',
      clientEventId: 'astroalign-x',
      fields: {
        title: 'Sunrise',
        description: 'desc',
        location: null,
        timeZone: 'UTC',
        start: '2027-08-01T07:00:00.000Z',
        end: '2027-08-01T07:05:00.000Z',
        reminderMinutes: 30
      }
    });

    expect(result.eventId).toBe('event-1');
    expect(calls[0].url).toBe('/api/calendar/google/events');
    expect(calls[0].init?.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init?.body)) as {
      action: string;
      request: { calendarId: string; clientEventId: string };
    };
    expect(body.action).toBe('create');
    expect(body.request.calendarId).toBe('primary');
    expect(body.request.clientEventId).toBe('astroalign-x');
  });

  it('MicrosoftCalendarProvider.updateEvent posts an update request', async () => {
    handler = () => jsonResponse({ eventId: 'event-2', eventUrl: null });
    const provider = new MicrosoftCalendarProvider();
    const result = await provider.updateEvent({
      calendarId: 'calendar-2',
      eventId: 'event-2',
      fields: {
        title: 'Moonset',
        description: 'desc',
        location: null,
        timeZone: 'UTC',
        start: '2027-08-01T07:00:00.000Z',
        end: '2027-08-01T07:05:00.000Z',
        reminderMinutes: 0
      }
    });

    expect(result.eventId).toBe('event-2');
    expect(calls[0].url).toBe('/api/calendar/microsoft/events');
    const body = JSON.parse(String(calls[0].init?.body)) as { action: string; request: { eventId: string } };
    expect(body.action).toBe('update');
    expect(body.request.eventId).toBe('event-2');
  });

  it('deleteEvent sends a DELETE with calendar and event query parameters', async () => {
    const provider = new GoogleCalendarProvider();
    await provider.deleteEvent('primary', 'event-1');

    expect(calls[0].url).toBe('/api/calendar/google/events?calendarId=primary&eventId=event-1');
    expect(calls[0].init?.method).toBe('DELETE');
  });

  it('surfaces server errors as CalendarApiError with the server message and status', async () => {
    handler = () => jsonResponse({ error: 'Calendar not found' }, 404);
    const provider = new GoogleCalendarProvider();

    await expect(provider.listCalendars()).rejects.toMatchObject({
      name: 'CalendarApiError',
      status: 404,
      message: 'Calendar not found'
    });
  });

  it('wraps network failures as CalendarApiError with status 0', async () => {
    handler = () => {
      throw new TypeError('Failed to fetch');
    };
    const provider = new MicrosoftCalendarProvider();

    await expect(provider.listCalendars()).rejects.toBeInstanceOf(CalendarApiError);
    await expect(provider.listCalendars()).rejects.toMatchObject({ status: 0 });
  });
});
