export type OAuthProviderKind = 'google' | 'microsoft';

/** Cookie names used to hold provider session data (HTTP-only, never JS-visible). */
export const TOKEN_COOKIES: Record<OAuthProviderKind, { access: string; refresh: string; email: string; expires: string }> = {
  google: {
    access: 'aa_google_access',
    refresh: 'aa_google_refresh',
    email: 'aa_google_email',
    expires: 'aa_google_expires'
  },
  microsoft: {
    access: 'aa_ms_access',
    refresh: 'aa_ms_refresh',
    email: 'aa_ms_email',
    expires: 'aa_ms_expires'
  }
};
