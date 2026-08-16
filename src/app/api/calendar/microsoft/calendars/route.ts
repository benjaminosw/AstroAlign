import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validAccessToken } from '../../../../../lib/server/accessToken';
import { requestCookieIO } from '../../../../../lib/server/tokenStore';
import { microsoftApiErrorMessage } from '../../../../../lib/server/calendarPayloads';

export const dynamic = 'force-dynamic';

interface MicrosoftCalendarItem {
  id?: unknown;
  name?: unknown;
  canEdit?: unknown;
}

export async function GET(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const token = await validAccessToken(requestCookieIO(request), 'microsoft', secure);
  if (!token.ok || !token.accessToken) {
    return NextResponse.json({ error: token.error }, { status: token.status });
  }

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: { Authorization: `Bearer ${token.accessToken}` }
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: microsoftApiErrorMessage(response.status, body) }, { status: response.status });
    }
    const items = (body as { value?: MicrosoftCalendarItem[] }).value ?? [];
    const calendars = items
      .filter((item) => item.canEdit !== false)
      .map((item) => ({
        id: String(item.id ?? ''),
        name: typeof item.name === 'string' ? item.name : 'Untitled calendar'
      }))
      .filter((calendar) => calendar.id.length > 0);
    return NextResponse.json({ calendars });
  } catch {
    return NextResponse.json({ error: 'Network error reaching Microsoft Calendar.' }, { status: 502 });
  }
}
