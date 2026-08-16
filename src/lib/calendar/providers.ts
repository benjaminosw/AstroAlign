import type { SavedAlignment } from '../saved/types';
import type { CalendarEventFields } from './eventContent';
import { requestJson } from './http';
import type { CalendarEventResult, CalendarOption } from './types';

export interface CalendarEventRequest {
  calendarId: string;
  /** The external event id when updating an existing event. */
  eventId?: string | null;
  /**
   * Deterministic client-supplied event id (Google only). Using the same id on
   * every create makes repeated attempts idempotent.
   */
  clientEventId?: string | null;
  fields: CalendarEventFields;
}

export interface CalendarProviderLike {
  listCalendars(): Promise<CalendarOption[]>;
  createEvent(_request: CalendarEventRequest): Promise<CalendarEventResult>;
  updateEvent(_request: CalendarEventRequest): Promise<CalendarEventResult>;
  deleteEvent(_calendarId: string, _eventId: string): Promise<void>;
}

/**
 * Deterministic external event id for an alignment. Google Calendar lets the
 * client supply an event `id`; reusing the same id for the same alignment
 * makes creation idempotent so duplicate events are never created.
 */
export function googleClientEventId(alignment: SavedAlignment): string {
  const sanitized = alignment.dedupeKey
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `astroalign-${sanitized}`;
}

export class GoogleCalendarProvider implements CalendarProviderLike {
  async listCalendars(): Promise<CalendarOption[]> {
    const data = await requestJson<{ calendars: CalendarOption[] }>('/api/calendar/google/calendars');
    return data.calendars;
  }

  async createEvent(request: CalendarEventRequest): Promise<CalendarEventResult> {
    return requestJson<CalendarEventResult>('/api/calendar/google/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', request })
    });
  }

  async updateEvent(request: CalendarEventRequest): Promise<CalendarEventResult> {
    return requestJson<CalendarEventResult>('/api/calendar/google/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', request })
    });
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const query = new URLSearchParams({ calendarId, eventId }).toString();
    await requestJson<{ ok: true }>(`/api/calendar/google/events?${query}`, { method: 'DELETE' });
  }
}

export class MicrosoftCalendarProvider implements CalendarProviderLike {
  async listCalendars(): Promise<CalendarOption[]> {
    const data = await requestJson<{ calendars: CalendarOption[] }>('/api/calendar/microsoft/calendars');
    return data.calendars;
  }

  async createEvent(request: CalendarEventRequest): Promise<CalendarEventResult> {
    return requestJson<CalendarEventResult>('/api/calendar/microsoft/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', request })
    });
  }

  async updateEvent(request: CalendarEventRequest): Promise<CalendarEventResult> {
    return requestJson<CalendarEventResult>('/api/calendar/microsoft/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', request })
    });
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const query = new URLSearchParams({ calendarId, eventId }).toString();
    await requestJson<{ ok: true }>(`/api/calendar/microsoft/events?${query}`, { method: 'DELETE' });
  }
}
