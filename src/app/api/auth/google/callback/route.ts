import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { exchangeAuthorizationCode, oauthConfigStatus } from '../../../../../lib/server/oauth';
import { responseCookieIO, tokenCookieOptions, writeProviderTokens } from '../../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const secure = request.nextUrl.protocol === 'https:';

  const config = oauthConfigStatus('google');
  if (!config.configured) {
    return NextResponse.redirect(`${origin}/?calendar_error=${encodeURIComponent('Google Calendar connection is not configured on the server.')}`);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');
  const storedState = request.cookies.get('aa_oauth_state')?.value;

  const fail = (message: string) => {
    const response = NextResponse.redirect(`${origin}/?calendar_error=${encodeURIComponent(message)}`);
    response.cookies.set('aa_oauth_state', '', tokenCookieOptions(secure, 0));
    return response;
  };

  if (oauthError === 'access_denied') {
    return fail('Google Calendar access was denied. You can try again from Settings.');
  }
  if (oauthError) {
    return fail(`Google sign-in failed: ${oauthError}`);
  }
  if (!code || !state || !storedState || state !== storedState) {
    return fail('Google sign-in could not be verified. Please try again.');
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokens = await exchangeAuthorizationCode('google', code, redirectUri);

    let email: string | null = null;
    try {
      const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (userInfoResponse.ok) {
        const profile = (await userInfoResponse.json()) as { email?: unknown };
        email = typeof profile.email === 'string' ? profile.email : null;
      }
    } catch {
      // Email is cosmetic — connection still succeeds without it.
    }

    const response = NextResponse.redirect(`${origin}/?calendar_connected=google`);
    response.cookies.set('aa_oauth_state', '', tokenCookieOptions(secure, 0));
    writeProviderTokens(
      responseCookieIO(response),
      'google',
      tokens.access_token,
      tokens.refresh_token ?? null,
      email,
      tokens.expires_in,
      secure
    );
    return response;
  } catch (exchangeError) {
    return fail(`Google sign-in failed: ${(exchangeError as Error).message}`);
  }
}
