export class CalendarApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CalendarApiError';
    this.status = status;
  }
}

/**
 * Thin JSON wrapper around `fetch` used by the client-side calendar
 * providers. All requests go to this app's own server routes, which hold the
 * OAuth tokens in HTTP-only cookies and proxy to Google/Microsoft. Client code
 * never talks to Google/Microsoft directly and never sees tokens.
 */
export async function requestJson<T>(path: string, init?: Parameters<typeof fetch>[1]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new CalendarApiError('Network error reaching the calendar service.', 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page) — still report the status.
  }

  if (!response.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `Calendar request failed (HTTP ${response.status}).`;
    throw new CalendarApiError(message, response.status);
  }

  return body as T;
}
