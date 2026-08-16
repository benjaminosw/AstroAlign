import type { SavedAlignment } from '../saved/types';

/** The two external calendar providers that create real calendar events. */
export type ExternalCalendarProvider = 'google' | 'microsoft';

/** Every calendar surface offered to the user, including the ICS fallback. */
export type CalendarProviderId = ExternalCalendarProvider | 'ics';

export interface CalendarConnection {
  connected: boolean;
  accountEmail: string | null;
}

export interface CalendarOption {
  id: string;
  name: string;
}

export type ReminderMinutes = 0 | 5 | 30 | 60 | 180 | 1440 | 10080;

export const REMINDER_OPTIONS: Array<{ label: string; minutes: ReminderMinutes }> = [
  { label: 'None', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '3 hours before', minutes: 180 },
  { label: '1 day before', minutes: 1440 },
  { label: '1 week before', minutes: 10080 }
];

export function reminderLabel(minutes: ReminderMinutes): string {
  const option = REMINDER_OPTIONS.find((candidate) => candidate.minutes === minutes);
  return option?.label ?? 'None';
}

/** Time in minutes the alignment event lasts in the external calendar. */
export const CALENDAR_EVENT_DURATION_MINUTES = 5;

export type CalendarSyncStatus = 'not-connected' | 'not-exported' | 'exported' | 'out-of-sync';

/**
 * Derives the external-calendar status of an alignment from the stored
 * integration metadata alone. Never reports a false "synced" state:
 * an integration is only `exported` when it exists and no alignment edit
 * has happened since the last successful sync.
 */
export function calendarSyncStatus(
  alignment: SavedAlignment,
  provider: ExternalCalendarProvider,
  connected: boolean
): CalendarSyncStatus {
  if (!connected) {
    return 'not-connected';
  }
  const integration = alignment.calendarIntegrations?.[provider];
  if (!integration) {
    return 'not-exported';
  }
  const syncedAt = new Date(integration.lastSyncedAt).getTime();
  const updatedAt = new Date(alignment.updatedAt).getTime();
  if (Number.isNaN(syncedAt) || Number.isNaN(updatedAt)) {
    return 'out-of-sync';
  }
  return updatedAt > syncedAt ? 'out-of-sync' : 'exported';
}

export interface CalendarEventResult {
  eventId: string;
  eventUrl: string | null;
  calendarId: string;
}
