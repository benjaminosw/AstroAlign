import type { CalendarEventFields } from '../calendar/eventContent';

/** Google Calendar API v3 event payload. */
export function googleEventPayload(fields: CalendarEventFields, clientEventId?: string | null) {
  return {
    ...(clientEventId ? { id: clientEventId } : {}),
    summary: fields.title,
    description: fields.description,
    ...(fields.location ? { location: fields.location } : {}),
    start: { dateTime: fields.start, timeZone: fields.timeZone },
    end: { dateTime: fields.end, timeZone: fields.timeZone },
    reminders:
      fields.reminderMinutes > 0
        ? { useDefault: false, overrides: [{ method: 'popup', minutes: fields.reminderMinutes }] }
        : { useDefault: false, overrides: [] }
  };
}

/** Microsoft Graph v1.0 event payload (Calendars.ReadWrite, delegated). */
export function microsoftEventPayload(fields: CalendarEventFields) {
  return {
    subject: fields.title,
    body: { contentType: 'text', content: fields.description },
    ...(fields.location ? { location: { displayName: fields.location } } : {}),
    start: { dateTime: fields.start, timeZone: fields.timeZone },
    end: { dateTime: fields.end, timeZone: fields.timeZone },
    isReminderOn: fields.reminderMinutes > 0,
    reminderMinutesBeforeStart: fields.reminderMinutes > 0 ? fields.reminderMinutes : 0
  };
}

/** Best-effort human-readable error message from a Google API error body. */
export function googleApiErrorMessage(status: number, body: unknown): string {
  const data = body as { error?: { message?: unknown } | unknown } | null;
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'object') {
    const message = (data as { error?: { message?: unknown } }).error?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return `Google Calendar request failed (HTTP ${status}).`;
}

/** Best-effort human-readable error message from a Microsoft Graph error body. */
export function microsoftApiErrorMessage(status: number, body: unknown): string {
  const data = body as { error?: { message?: unknown } | unknown } | null;
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'object') {
    const message = (data as { error?: { message?: unknown } }).error?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return `Microsoft Calendar request failed (HTTP ${status}).`;
}
