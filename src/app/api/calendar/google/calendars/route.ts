import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validAccessToken } from '../../../../../lib/server/accessToken';
import { requestCookieIO } from '../../../../../lib/server/tokenStore';
import { googleApiErrorMessage } from '../../../../../lib/server/calendarPayloads';

export const dynamic = 'force-dynamic';

interface GoogleCalendarListItem {
  id?: unknown;
  summary?: unknown;
  deleted?: unknown;
}

export async function GET(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'google', secure);
  if (!token.ok || !token.accessToken) {
    return NextResponse.json({ error: token.error }, { status: token.status });
  }

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50', {
      headers: { Authorization: `Bearer ${token.accessToken}` }
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: googleApiErrorMessage(response.status, body) }, { status: response.status });
    }
    const items = (body as { items?: GoogleCalendarListItem[] }).items ?? [];
    const calendars = items
      .filter((item) => item.deleted !== true)
      .map((item) => ({
        id: String(item.id ?? ''),
        name: typeof item.summary === 'string' ? item.summary : 'Untitled calendar'
      }))
      .filter((calendar) => calendar.id.length > 0);
    return NextResponse.json({ calendars });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Google Calendar.' }, { status: 502 });
  }
}
