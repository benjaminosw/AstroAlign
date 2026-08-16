import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { revokeGoogleRefreshToken } from '../../../../../lib/server/oauth';
import { clearProviderTokens, readProviderTokens, requestCookieIO, responseCookieIO } from '../../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tokens = readProviderTokens(requestCookieIO(request), 'google');
  if (tokens.refreshToken) {
    try {
      await revokeGoogleRefreshToken(tokens.refreshToken);
    } catch {
      // Revocation is best-effort; the local session is cleared regardless.
    }
  }
  const secure = request.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true });
  clearProviderTokens(responseCookieIO(response), 'google', secure);
  return response;
}
