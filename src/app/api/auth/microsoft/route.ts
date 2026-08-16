import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildAuthorizeUrl, createOAuthState, oauthConfigStatus } from '../../../../lib/server/oauth';
import { tokenCookieOptions } from '../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const config = oauthConfigStatus('microsoft');
  if (!config.configured) {
    return NextResponse.json(
      { error: 'Microsoft Calendar connection is not configured on the server. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.' },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  const secure = request.nextUrl.protocol === 'https:';
  const state = createOAuthState();
  const redirectUri = `${origin}/api/auth/microsoft/callback`;
  const authorizeUrl = buildAuthorizeUrl('microsoft', redirectUri, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('aa_oauth_state', state, tokenCookieOptions(secure, 600));
  return response;
}
