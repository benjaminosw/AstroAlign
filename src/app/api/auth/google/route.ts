import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildAuthorizeUrl, createOAuthState, oauthConfigStatus } from '../../../../lib/server/oauth';
import { tokenCookieOptions } from '../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const config = oauthConfigStatus('google');
  if (!config.configured) {
    return NextResponse.json(
      { error: 'Google Calendar connection is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  const secure = request.nextUrl.protocol === 'https:';
  const state = createOAuthState();
  const redirectUri = `${origin}/api/auth/google/callback`;
  const authorizeUrl = buildAuthorizeUrl('google', redirectUri, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('aa_oauth_state', state, tokenCookieOptions(secure, 600));
  return response;
}
