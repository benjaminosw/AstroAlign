import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { oauthConfigStatus } from '../../../../../lib/server/oauth';
import { hasProviderTokens, isAccessTokenUsable, readProviderTokens, requestCookieIO } from '../../../../../lib/server/tokenStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const config = oauthConfigStatus('microsoft');
  if (!config.configured) {
    return NextResponse.json({ connected: false, accountEmail: null });
  }
  const tokens = readProviderTokens(requestCookieIO(request), 'microsoft');
  if (!hasProviderTokens(tokens)) {
    return NextResponse.json({ connected: false, accountEmail: null });
  }
  const usable = isAccessTokenUsable(tokens) || Boolean(tokens.refreshToken);
  return NextResponse.json({ connected: usable, accountEmail: tokens.email });
}
