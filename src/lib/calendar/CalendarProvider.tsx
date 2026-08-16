'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SavedAlignment, CalendarIntegrationEntry } from '../saved/types';
import { usePersistedState } from '../storage/appState';
import { CALENDAR_EVENT_DURATION_MINUTES } from './types';
import type { CalendarConnection, CalendarEventResult, CalendarOption, ExternalCalendarProvider, ReminderMinutes } from './types';
import { buildCalendarEventFields } from './eventContent';
import { requestJson } from './http';
import { buildIcsCalendar } from './ics';
import { GoogleCalendarProvider, MicrosoftCalendarProvider, googleClientEventId } from './providers';

export interface CalendarOperationInput {
  alignment: SavedAlignment;
  targetName: string | null;
  calendarId: string;
  reminderMinutes: ReminderMinutes;
}

export interface CalendarUpdateInput {
  alignment: SavedAlignment;
  targetName: string | null;
  integration: CalendarIntegrationEntry;
  reminderMinutes: ReminderMinutes;
}

interface CalendarContextValue {
  connections: Record<ExternalCalendarProvider, CalendarConnection>;
  calendars: Record<ExternalCalendarProvider, CalendarOption[]>;
  connectionStatus: 'idle' | 'checking' | 'ready' | 'error';
  calendarsStatus: Record<ExternalCalendarProvider, 'idle' | 'loading' | 'ready' | 'error'>;
  selectedGoogleCalendarId: string | null;
  selectedMicrosoftCalendarId: string | null;
  setSelectedGoogleCalendarId: (_id: string) => void;
  setSelectedMicrosoftCalendarId: (_id: string) => void;
  reminderDefault: ReminderMinutes;
  setReminderDefault: (_minutes: ReminderMinutes) => void;
  refreshConnections: () => Promise<void>;
  refreshCalendars: (_provider: ExternalCalendarProvider) => Promise<void>;
  connectGoogle: () => void;
  connectMicrosoft: () => void;
  disconnectGoogle: () => Promise<void>;
  disconnectMicrosoft: () => Promise<void>;
  createEvent: (_provider: ExternalCalendarProvider, _input: CalendarOperationInput) => Promise<CalendarEventResult>;
  updateEvent: (_provider: ExternalCalendarProvider, _input: CalendarUpdateInput) => Promise<CalendarEventResult>;
  deleteEvent: (_provider: ExternalCalendarProvider, _integration: CalendarIntegrationEntry) => Promise<void>;
  exportToIcs: (
    _alignment: SavedAlignment,
    _targetName: string | null,
    _reminderMinutes: ReminderMinutes
  ) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

const EMPTY_CONNECTIONS: Record<ExternalCalendarProvider, CalendarConnection> = {
  google: { connected: false, accountEmail: null },
  microsoft: { connected: false, accountEmail: null }
};

const EMPTY_CALENDARS: Record<ExternalCalendarProvider, CalendarOption[]> = {
  google: [],
  microsoft: []
};

function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Record<ExternalCalendarProvider, CalendarConnection>>(EMPTY_CONNECTIONS);
  const [calendars, setCalendars] = useState<Record<ExternalCalendarProvider, CalendarOption[]>>(EMPTY_CALENDARS);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [calendarsStatus, setCalendarsStatus] = useState<
    Record<ExternalCalendarProvider, 'idle' | 'loading' | 'ready' | 'error'>
  >({ google: 'idle', microsoft: 'idle' });

  const [selectedGoogleCalendarId, setSelectedGoogleCalendarId] = usePersistedState<string | null>(
    'calendar.googleCalendarId',
    'primary'
  );
  const [selectedMicrosoftCalendarId, setSelectedMicrosoftCalendarId] = usePersistedState<string | null>(
    'calendar.microsoftCalendarId',
    null
  );
  const [reminderDefault, setReminderDefault] = usePersistedState<ReminderMinutes>('calendar.reminderDefault', 30);

  const googleProvider = useMemo(() => new GoogleCalendarProvider(), []);
  const microsoftProvider = useMemo(() => new MicrosoftCalendarProvider(), []);

  const refreshConnections = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      const [google, microsoft] = await Promise.all([
        requestJson<{ connected: boolean; accountEmail: string | null }>('/api/auth/google/status'),
        requestJson<{ connected: boolean; accountEmail: string | null }>('/api/auth/microsoft/status')
      ]);
      setConnections({ google, microsoft });
      setConnectionStatus('ready');
      return;
    } catch {
      setConnections(EMPTY_CONNECTIONS);
      setConnectionStatus('error');
    }
  }, []);

  const refreshCalendars = useCallback(async (provider: ExternalCalendarProvider) => {
    setCalendarsStatus((current) => ({ ...current, [provider]: 'loading' }));
    try {
      const data =
        provider === 'google'
          ? await requestJson<{ calendars: CalendarOption[] }>('/api/calendar/google/calendars')
          : await requestJson<{ calendars: CalendarOption[] }>('/api/calendar/microsoft/calendars');
      setCalendars((current) => ({ ...current, [provider]: data.calendars }));
      setCalendarsStatus((current) => ({ ...current, [provider]: 'ready' }));
    } catch {
      setCalendars((current) => ({ ...current, [provider]: [] }));
      setCalendarsStatus((current) => ({ ...current, [provider]: 'error' }));
    }
  }, []);

  function connectGoogle() {
    window.location.assign('/api/auth/google');
  }

  function connectMicrosoft() {
    window.location.assign('/api/auth/microsoft');
  }

  async function disconnectGoogle() {
    try {
      await requestJson<{ ok: true }>('/api/auth/google/disconnect', { method: 'POST' });
    } catch {
      // Best-effort — local cookies are cleared even if the remote revoke fails.
    }
    setConnections((current) => ({ ...current, google: { connected: false, accountEmail: null } }));
    setCalendars((current) => ({ ...current, google: [] }));
  }

  async function disconnectMicrosoft() {
    try {
      await requestJson<{ ok: true }>('/api/auth/microsoft/disconnect', { method: 'POST' });
    } catch {
      // Best-effort.
    }
    setConnections((current) => ({ ...current, microsoft: { connected: false, accountEmail: null } }));
    setCalendars((current) => ({ ...current, microsoft: [] }));
  }

  async function createEvent(provider: ExternalCalendarProvider, input: CalendarOperationInput): Promise<CalendarEventResult> {
    const fields = buildCalendarEventFields(
      input.alignment,
      input.targetName,
      CALENDAR_EVENT_DURATION_MINUTES,
      input.reminderMinutes
    );
    const request = {
      calendarId: input.calendarId,
      fields,
      clientEventId: provider === 'google' ? googleClientEventId(input.alignment) : null
    };
    return provider === 'google'
      ? googleProvider.createEvent(request)
      : microsoftProvider.createEvent(request);
  }

  async function updateEvent(provider: ExternalCalendarProvider, input: CalendarUpdateInput): Promise<CalendarEventResult> {
    const fields = buildCalendarEventFields(
      input.alignment,
      input.targetName,
      CALENDAR_EVENT_DURATION_MINUTES,
      input.reminderMinutes
    );
    const request = {
      calendarId: input.integration.calendarId,
      eventId: input.integration.eventId,
      fields,
      clientEventId: provider === 'google' ? googleClientEventId(input.alignment) : null
    };
    return provider === 'google'
      ? googleProvider.updateEvent(request)
      : microsoftProvider.updateEvent(request);
  }

  async function deleteEvent(provider: ExternalCalendarProvider, integration: CalendarIntegrationEntry): Promise<void> {
    if (provider === 'google') {
      await googleProvider.deleteEvent(integration.calendarId, integration.eventId);
      return;
    }
    await microsoftProvider.deleteEvent(integration.calendarId, integration.eventId);
  }

  function exportToIcs(alignment: SavedAlignment, targetName: string | null, reminderMinutes: ReminderMinutes) {
    const { fileName, content } = buildIcsCalendar(alignment, targetName, reminderMinutes);
    downloadTextFile(fileName, content);
  }

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  const value: CalendarContextValue = {
    connections,
    calendars,
    connectionStatus,
    calendarsStatus,
    selectedGoogleCalendarId,
    selectedMicrosoftCalendarId,
    setSelectedGoogleCalendarId,
    setSelectedMicrosoftCalendarId,
    reminderDefault,
    setReminderDefault,
    refreshConnections,
    refreshCalendars,
    connectGoogle,
    connectMicrosoft,
    disconnectGoogle,
    disconnectMicrosoft,
    createEvent,
    updateEvent,
    deleteEvent,
    exportToIcs
  };

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
