import type { OAuthProviderKind } from './oauthTypes';
import { TOKEN_COOKIES } from './oauthTypes';

export interface TokenCookieOptions {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge?: number;
}

/**
 * Minimal cookie abstraction so token handling can be unit tested without a
 * running Next.js server. `NextRequest`/`NextResponse` satisfy both sides.
 */
export interface TokenCookieIO {
  get(_name: string): string | { value: string } | undefined;
  set(_name: string, _value: string, _options: TokenCookieOptions): void;
  delete(_name: string, _options: TokenCookieOptions): void;
}

export function tokenCookieOptions(secure: boolean, maxAge?: number): TokenCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    ...(maxAge !== undefined ? { maxAge } : {})
  };
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken: string | null;
  email: string | null;
  expiresAtMs: number;
}

function cookieValue(cookie: string | { value: string } | undefined): string {
  return typeof cookie === 'string' ? cookie : (cookie?.value ?? '');
}

export function readProviderTokens(io: TokenCookieIO, kind: OAuthProviderKind): ProviderTokens {
  const names = TOKEN_COOKIES[kind];
  const accessToken = cookieValue(io.get(names.access));
  const refreshToken = cookieValue(io.get(names.refresh)) || null;
  const email = cookieValue(io.get(names.email)) || null;
  const expiresAtMs = Number(cookieValue(io.get(names.expires)) || 0);
  return { accessToken, refreshToken, email, expiresAtMs };
}

export function hasProviderTokens(tokens: ProviderTokens): boolean {
  return tokens.accessToken.length > 0;
}

export function writeProviderTokens(
  io: TokenCookieIO,
  kind: OAuthProviderKind,
  accessToken: string,
  refreshToken: string | null,
  email: string | null,
  expiresInSeconds: number,
  secure: boolean
): void {
  const names = TOKEN_COOKIES[kind];
  const now = Date.now();
  io.set(names.access, accessToken, tokenCookieOptions(secure, Math.max(60, expiresInSeconds)));
  io.set(names.expires, String(now + expiresInSeconds * 1000), tokenCookieOptions(secure, Math.max(60, expiresInSeconds)));
  if (refreshToken) {
    io.set(names.refresh, refreshToken, tokenCookieOptions(secure, 60 * 60 * 24 * 180));
  }
  if (email) {
    io.set(names.email, email, tokenCookieOptions(secure, 60 * 60 * 24 * 30));
  }
}

export function clearProviderTokens(io: TokenCookieIO, kind: OAuthProviderKind, secure: boolean): void {
  const names = TOKEN_COOKIES[kind];
  for (const name of [names.access, names.refresh, names.email, names.expires]) {
    io.delete(name, tokenCookieOptions(secure));
  }
}

/** True when an access token exists and has not expired. */
export function isAccessTokenUsable(tokens: ProviderTokens): boolean {
  return tokens.accessToken.length > 0 && tokens.expiresAtMs > Date.now();
}

/**
 * Adapts a NextRequest's cookie jar to the minimal TokenCookieIO interface.
 * Reads are wired; writes are no-ops (requests are read-only).
 */
export function requestCookieIO(request: { cookies: { get(_name: string): { value: string } | undefined } }): TokenCookieIO {
  return {
    get: (name) => request.cookies.get(name)?.value,
    set: () => {},
    delete: () => {}
  };
}

/**
 * Adapts a NextResponse's cookie jar so token helpers can set/clear HTTP-only
 * cookies on the outgoing response.
 */
export function responseCookieIO(response: {
  cookies: {
    get(_name: string): { value: string } | undefined;
    set(_name: string, _value: string, _options: TokenCookieOptions): void;
    delete(_name: string): void;
  };
}): TokenCookieIO {
  return {
    get: (name) => response.cookies.get(name)?.value,
    set: (name, value, options) => {
      response.cookies.set(name, value, options);
    },
    delete: (name) => {
      response.cookies.delete(name);
    }
  };
}
