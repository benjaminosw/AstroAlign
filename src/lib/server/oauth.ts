import { randomBytes } from 'node:crypto';
import type { OAuthProviderKind } from './oauthTypes';

export const OAUTH_ENV = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET'
  },
  microsoft: {
    clientId: 'MICROSOFT_CLIENT_ID',
    clientSecret: 'MICROSOFT_CLIENT_SECRET'
  }
} as const;

const OAUTH_ENDPOINTS: Record<OAuthProviderKind, { authorizeUrl: string; tokenUrl: string; scopes: string[] }> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
  },
  microsoft: {
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['offline_access', 'Calendars.ReadWrite']
  }
};

export interface OAuthConfigStatus {
  configured: boolean;
  clientId: string | null;
}

export function oauthConfigStatus(kind: OAuthProviderKind): OAuthConfigStatus {
  const clientId = process.env[OAUTH_ENV[kind].clientId] ?? null;
  const clientSecret = process.env[OAUTH_ENV[kind].clientSecret] ?? null;
  return { configured: Boolean(clientId && clientSecret), clientId };
}

export function createOAuthState(): string {
  return randomBytes(32).toString('hex');
}

export function buildAuthorizeUrl(kind: OAuthProviderKind, redirectUri: string, state: string): string {
  const config = OAUTH_ENDPOINTS[kind];
  const clientId = process.env[OAUTH_ENV[kind].clientId];
  if (!clientId) {
    throw new Error(`OAuth client id for ${kind} is not configured`);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state
  });
  if (kind === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

async function requestToken(kind: OAuthProviderKind, params: URLSearchParams): Promise<OAuthTokenResponse> {
  const tokenUrl = OAUTH_ENDPOINTS[kind].tokenUrl;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token exchange failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }
  const data = (await response.json()) as Partial<OAuthTokenResponse>;
  if (!data.access_token) {
    throw new Error(`OAuth token exchange returned no access token for ${kind}.`);
  }
  return data as OAuthTokenResponse;
}

function clientCredentials(kind: OAuthProviderKind) {
  const clientId = process.env[OAUTH_ENV[kind].clientId];
  const clientSecret = process.env[OAUTH_ENV[kind].clientSecret];
  if (!clientId || !clientSecret) {
    throw new Error(`OAuth client credentials for ${kind} are not configured.`);
  }
  return { clientId, clientSecret };
}

export function exchangeAuthorizationCode(
  kind: OAuthProviderKind,
  code: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  const { clientId, clientSecret } = clientCredentials(kind);
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  return requestToken(kind, params);
}

export function refreshAccessToken(
  kind: OAuthProviderKind,
  refreshToken: string
): Promise<OAuthTokenResponse> {
  const { clientId, clientSecret } = clientCredentials(kind);
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  return requestToken(kind, params);
}

export async function revokeGoogleRefreshToken(refreshToken: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
}
