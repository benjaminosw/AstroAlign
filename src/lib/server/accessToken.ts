import type { OAuthProviderKind } from './oauthTypes';
import { oauthConfigStatus, refreshAccessToken } from './oauth';
import {
  hasProviderTokens,
  isAccessTokenUsable,
  readProviderTokens,
  writeProviderTokens,
  type TokenCookieIO
} from './tokenStore';

const PROVIDER_LABELS: Record<OAuthProviderKind, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook'
};

export interface AccessTokenResult {
  ok: boolean;
  status: number;
  error?: string;
  accessToken?: string;
}

/**
 * Returns a usable access token for the provider, refreshing it from the
 * HTTP-only refresh-token cookie when it has expired. Never returns tokens to
 * the client — callers use the token to call Google/Microsoft server-side.
 */
export async function validAccessToken(
  io: TokenCookieIO,
  kind: OAuthProviderKind,
  secure: boolean
): Promise<AccessTokenResult> {
  const label = PROVIDER_LABELS[kind];
  const config = oauthConfigStatus(kind);
  if (!config.configured) {
    return { ok: false, status: 503, error: `${label} connection is not configured on the server.` };
  }

  const tokens = readProviderTokens(io, kind);
  if (!hasProviderTokens(tokens)) {
    return { ok: false, status: 401, error: `Not connected to ${label}. Connect your calendar in Settings.` };
  }
  if (isAccessTokenUsable(tokens)) {
    return { ok: true, status: 200, accessToken: tokens.accessToken };
  }
  if (!tokens.refreshToken) {
    return { ok: false, status: 401, error: `Your ${label} connection has expired. Reconnect in Settings.` };
  }

  try {
    const refreshed = await refreshAccessToken(kind, tokens.refreshToken);
    writeProviderTokens(io, kind, refreshed.access_token, null, tokens.email, refreshed.expires_in, secure);
    return { ok: true, status: 200, accessToken: refreshed.access_token };
  } catch {
    return {
      ok: false,
      status: 401,
      error: `Could not refresh your ${label} connection. Reconnect in Settings.`
    };
  }
}
