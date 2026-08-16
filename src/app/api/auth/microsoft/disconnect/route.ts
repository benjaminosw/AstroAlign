import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearProviderTokens, responseCookieIO } from '../../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true });
  clearProviderTokens(responseCookieIO(response), 'microsoft', secure);
  return response;
}
