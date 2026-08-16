import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validAccessToken } from '../../../../../lib/server/accessToken';
import { requestCookieIO } from '../../../../../lib/server/tokenStore';
import { microsoftApiErrorMessage, microsoftEventPayload } from '../../../../../lib/server/calendarPayloads';
import type { CalendarEventFields } from '../../../../../lib/calendar/eventContent';
import type { CalendarEventRequest } from '../../../../../lib/calendar/providers';

export const dynamic = 'force-dynamic';

const GRAPH_EVENTS_BASE = 'https://graph.microsoft.com/v1.0/me';

interface MicrosoftEventResponse {
  id?: unknown;
  webLink?: unknown;
}

async function fetchJson(path: string, init: Parameters<typeof fetch>[1]): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  return { response, body };
}

export async function POST(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'microsoft', secure);
  if (!token.ok || !token.accessToken) {
    return NextResponse.json({ error: token.error }, { status: token.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const eventRequest = (body as { request?: unknown }).request as CalendarEventRequest | undefined;
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
  const jsonBody = JSON.stringify(microsoftEventPayload(fields));

  try {
    if (action === 'update') {
      if (!eventRequest.eventId) {
        return NextResponse.json({ error: 'Missing event id for update.' }, { status: 400 });
      }
      let { response, body: responseBody } = await fetchJson(
        `${GRAPH_EVENTS_BASE}/calendars/${encodedCalendarId}/events/${encodeURIComponent(eventRequest.eventId)}`,
        { method: 'PATCH', headers: authorization, body: jsonBody }
      );
      if (response.status === 404) {
        const created = await fetchJson(
          `${GRAPH_EVENTS_BASE}/calendars/${encodedCalendarId}/events`,
          { method: 'POST', headers: authorization, body: jsonBody }
        );
        response = created.response;
        responseBody = created.body;
      }
      if (!response.ok) {
        return NextResponse.json({ error: microsoftApiErrorMessage(response.status, responseBody) }, { status: response.status });
      }
      const event = responseBody as MicrosoftEventResponse;
      return NextResponse.json({
        eventId: String(event.id ?? ''),
        eventUrl: typeof event.webLink === 'string' ? event.webLink : null,
        calendarId: eventRequest.calendarId
      });
    }

    const { response, body: responseBody } = await fetchJson(
      `${GRAPH_EVENTS_BASE}/calendars/${encodedCalendarId}/events`,
      { method: 'POST', headers: authorization, body: jsonBody }
    );
    if (!response.ok) {
      return NextResponse.json({ error: microsoftApiErrorMessage(response.status, responseBody) }, { status: response.status });
    }
    const event = responseBody as MicrosoftEventResponse;
    return NextResponse.json({
      eventId: String(event.id ?? ''),
      eventUrl: typeof event.webLink === 'string' ? event.webLink : null,
      calendarId: eventRequest.calendarId
    });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Microsoft Calendar.' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'microsoft', secure);
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
      `${GRAPH_EVENTS_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token.accessToken}` } }
    );
    if (!response.ok && response.status !== 404) {
      const responseBody: unknown = await response.json().catch(() => null);
      return NextResponse.json({ error: microsoftApiErrorMessage(response.status, responseBody) }, { status: response.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Microsoft Calendar.' }, { status: 502 });
  }
}
