import type { CalendarEventDraft } from './types';

/**
 * Formats an instant as an IANA-agnostic UTC compact timestamp used by
 * Google Calendar template URLs: 20260829T114218Z
 */
export function formatCompactUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Builds a Google Calendar "create event" template URL.
 *
 * This does NOT use the Google Calendar API or OAuth. It simply opens
 * calendar.google.com with the event details pre-filled; the user reviews
 * and saves the event there themselves. AstroAlign never learns whether
 * the user saved it.
 */
export function buildGoogleCalendarUrl(draft: CalendarEventDraft): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', draft.title);
  params.set('dates', `${formatCompactUtc(draft.startUtc)}/${formatCompactUtc(draft.endUtc)}`);
  params.set('details', draft.description);
  params.set('ctz', draft.timeZone);
  if (draft.location) {
    params.set('location', draft.location);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
