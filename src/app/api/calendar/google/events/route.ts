import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validAccessToken } from '../../../../../lib/server/accessToken';
import { requestCookieIO } from '../../../../../lib/server/tokenStore';
import { googleApiErrorMessage, googleEventPayload } from '../../../../../lib/server/calendarPayloads';
import type { CalendarEventFields } from '../../../../../lib/calendar/eventContent';
import type { CalendarEventRequest } from '../../../../../lib/calendar/providers';

export const dynamic = 'force-dynamic';

const GOOGLE_EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

interface GoogleEventResponse {
  id?: unknown;
  htmlLink?: unknown;
}

async function fetchJson(path: string, init: Parameters<typeof fetch>[1]): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  return { response, body };
}

export async function POST(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'google', secure);
  if (!token.ok || !token.accessToken) {
    return NextResponse.json({ error: token.error }, { status: token.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const eventRequest = (body as { action?: unknown; request?: unknown }).request as CalendarEventRequest | undefined;
  const action = (body as { action?: unknown }).action;
  if (!eventRequest || typeof eventRequest !== 'object') {
    return NextResponse.json({ error: 'Missing event request.' }, { status: 400 });
  }
  if (typeof eventRequest.calendarId !== 'string' || eventRequest.calendarId.length === 0) {
    return NextResponse.json({ error: 'A calendar must be selected.' }, { status: 400 });
  }
  const fields = eventRequest.fields as CalendarEventFields | undefined;
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'Missing event details.' }, { status: 400 });
  }

  const encodedCalendarId = encodeURIComponent(eventRequest.calendarId);
  const authorization = { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' };
  const jsonBody = JSON.stringify(googleEventPayload(fields, eventRequest.clientEventId));

  try {
    if (action === 'update') {
      if (!eventRequest.eventId) {
        return NextResponse.json({ error: 'Missing event id for update.' }, { status: 400 });
      }
      let { response, body: responseBody } = await fetchJson(
        `${GOOGLE_EVENTS_BASE}/${encodedCalendarId}/events/${encodeURIComponent(eventRequest.eventId)}`,
        { method: 'PUT', headers: authorization, body: jsonBody }
      );
      if (response.status === 404 && eventRequest.clientEventId) {
        const created = await fetchJson(
          `${GOOGLE_EVENTS_BASE}/${encodedCalendarId}/events`,
          { method: 'POST', headers: authorization, body: jsonBody }
        );
        response = created.response;
        responseBody = created.body;
      }
      if (!response.ok) {
        return NextResponse.json({ error: googleApiErrorMessage(response.status, responseBody) }, { status: response.status });
      }
      const event = responseBody as GoogleEventResponse;
      return NextResponse.json({
        eventId: String(event.id ?? ''),
        eventUrl: typeof event.htmlLink === 'string' ? event.htmlLink : null,
        calendarId: eventRequest.calendarId
      });
    }

    let { response, body: responseBody } = await fetchJson(`${GOOGLE_EVENTS_BASE}/${encodedCalendarId}/events`, {
      method: 'POST',
      headers: authorization,
      body: jsonBody
    });
    if (response.status === 409 && eventRequest.clientEventId) {
      const existing = await fetchJson(
        `${GOOGLE_EVENTS_BASE}/${encodedCalendarId}/events/${encodeURIComponent(eventRequest.clientEventId)}`,
        { headers: { Authorization: `Bearer ${token.accessToken}` } }
      );
      if (existing.response.ok) {
        response = existing.response;
        responseBody = existing.body;
      }
    }
    if (!response.ok) {
      return NextResponse.json({ error: googleApiErrorMessage(response.status, responseBody) }, { status: response.status });
    }
    const event = responseBody as GoogleEventResponse;
    return NextResponse.json({
      eventId: String(event.id ?? ''),
      eventUrl: typeof event.htmlLink === 'string' ? event.htmlLink : null,
      calendarId: eventRequest.calendarId
    });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Google Calendar.' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'google', secure);
  if (!token.ok || !token.accessToken) {
    return NextResponse.json({ error: token.error }, { status: token.status });
  }

  const calendarId = request.nextUrl.searchParams.get('calendarId');
  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!calendarId || !eventId) {
    return NextResponse.json({ error: 'Missing calendar or event id.' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${GOOGLE_EVENTS_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token.accessToken}` } }
    );
    if (!response.ok && response.status !== 404) {
      const responseBody: unknown = await response.json().catch(() => null);
      return NextResponse.json({ error: googleApiErrorMessage(response.status, responseBody) }, { status: response.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Google Calendar.' }, { status: 502 });
  }
}
