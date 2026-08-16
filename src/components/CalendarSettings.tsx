'use client';

import { useEffect, useState } from 'react';
import { useCalendar } from '../lib/calendar/CalendarProvider';
import { REMINDER_OPTIONS } from '../lib/calendar/types';
import type { ExternalCalendarProvider, ReminderMinutes } from '../lib/calendar/types';

const PROVIDER_LABELS: Record<ExternalCalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Calendar'
};

export default function CalendarSettings() {
  const {
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
    disconnectMicrosoft
  } = useCalendar();

  const [notice, setNotice] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<ExternalCalendarProvider | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const error = params.get('calendar_error');
    if (connected === 'google' || connected === 'microsoft' || error) {
      if (connected === 'google' || connected === 'microsoft') {
        setNotice(
          connected === 'google'
            ? 'Connected to Google Calendar. Choose a calendar below.'
            : 'Connected to Microsoft Calendar. Choose a calendar below.'
        );
        void refreshConnections();
        void refreshCalendars(connected);
      } else if (error) {
        setNotice(error);
      }
      params.delete('calendar_connected');
      params.delete('calendar_error');
      const search = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
    }
  }, [refreshConnections, refreshCalendars]);

  useEffect(() => {
    if (connections.google.connected) {
      void refreshCalendars('google');
    }
    if (connections.microsoft.connected) {
      void refreshCalendars('microsoft');
    }
  }, [connections.google.connected, connections.microsoft.connected, refreshCalendars]);

  async function handleDisconnect(provider: ExternalCalendarProvider) {
    const label = PROVIDER_LABELS[provider];
    if (!window.confirm(`Disconnect ${label}? Events you already exported stay in your calendar; they just won't be updated from here.`)) {
      return;
    }
    setBusyProvider(provider);
    try {
      if (provider === 'google') {
        await disconnectGoogle();
      } else {
        await disconnectMicrosoft();
      }
      setNotice(`Disconnected from ${label}.`);
    } catch {
      setNotice(`Could not disconnect from ${label}. Please try again.`);
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <section data-testid="calendar-settings" className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Calendar</h2>
      <p className="mt-1 text-xs text-slate-500">
        Connect a calendar to add saved alignments as events with reminders. The calendar — not AstroAlign — owns
        notifications, so there is no in-app reminder system.
      </p>

      {notice && (
        <div
          data-testid="calendar-settings-notice"
          className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-emerald-600 bg-emerald-950/60 p-3 text-sm text-emerald-200"
        >
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="rounded-lg px-2 py-0.5 text-lg leading-none text-emerald-300 transition hover:bg-emerald-900 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {connectionStatus === 'checking' ? (
        <p className="mt-4 text-sm text-slate-400">Checking calendar connections…</p>
      ) : connectionStatus === 'error' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">
          <p>Could not check calendar connections.</p>
          <button
            type="button"
            onClick={() => void refreshConnections()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <ProviderPanel
            provider="google"
            connected={connections.google.connected}
            accountEmail={connections.google.accountEmail}
            calendars={calendars.google}
            calendarsStatus={calendarsStatus.google}
            selectedCalendarId={selectedGoogleCalendarId}
            onSelectCalendar={(id) => setSelectedGoogleCalendarId(id)}
            onConnect={connectGoogle}
            onDisconnect={() => handleDisconnect('google')}
            onRefreshCalendars={() => void refreshCalendars('google')}
            busy={busyProvider === 'google'}
          />
          <ProviderPanel
            provider="microsoft"
            connected={connections.microsoft.connected}
            accountEmail={connections.microsoft.accountEmail}
            calendars={calendars.microsoft}
            calendarsStatus={calendarsStatus.microsoft}
            selectedCalendarId={selectedMicrosoftCalendarId}
            onSelectCalendar={(id) => setSelectedMicrosoftCalendarId(id)}
            onConnect={connectMicrosoft}
            onDisconnect={() => handleDisconnect('microsoft')}
            onRefreshCalendars={() => void refreshCalendars('microsoft')}
            busy={busyProvider === 'microsoft'}
          />
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="calendar-reminder-default" className="text-sm text-slate-300">
          Default reminder
        </label>
        <select
          id="calendar-reminder-default"
          data-testid="calendar-reminder-default"
          value={reminderDefault}
          onChange={(event) => setReminderDefault(Number(event.target.value) as ReminderMinutes)}
          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        >
          {REMINDER_OPTIONS.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-500">
          Used as the reminder on every event added to a calendar. You can change it per event later in your calendar.
        </p>
      </div>
    </section>
  );
}

interface ProviderPanelProps {
  provider: ExternalCalendarProvider;
  connected: boolean;
  accountEmail: string | null;
  calendars: { id: string; name: string }[];
  calendarsStatus: 'idle' | 'loading' | 'ready' | 'error';
  selectedCalendarId: string | null;
  onSelectCalendar: (_id: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshCalendars: () => void;
  busy: boolean;
}

function ProviderPanel({
  provider,
  connected,
  accountEmail,
  calendars,
  calendarsStatus,
  selectedCalendarId,
  onSelectCalendar,
  onConnect,
  onDisconnect,
  onRefreshCalendars,
  busy
}: ProviderPanelProps) {
  const label = PROVIDER_LABELS[provider];
  const effectiveCalendarId =
    selectedCalendarId && calendars.some((calendar) => calendar.id === selectedCalendarId)
      ? selectedCalendarId
      : (calendars[0]?.id ?? '');

  return (
    <div data-testid={`calendar-provider-${provider}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{label}</p>
          {connected ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Connected
            </span>
          ) : (
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
              Not connected
            </span>
          )}
        </div>
        {connected ? (
          <button
            type="button"
            data-testid={`disconnect-${provider}`}
            disabled={busy}
            onClick={onDisconnect}
            className="rounded-lg border border-rose-700/70 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            data-testid={`connect-${provider}`}
            onClick={onConnect}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Connect
          </button>
        )}
      </div>

      {connected && (
        <div className="mt-3 space-y-3">
          {accountEmail && <p className="text-xs text-slate-400">{accountEmail}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`${label} calendar`}
              data-testid={`calendar-select-${provider}`}
              value={effectiveCalendarId}
              onChange={(event) => onSelectCalendar(event.target.value)}
              disabled={calendarsStatus === 'loading' || calendars.length === 0}
              className="min-w-56 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {calendarsStatus === 'loading' ? (
                <option value="">Loading calendars…</option>
              ) : calendars.length === 0 ? (
                <option value="">No calendars available</option>
              ) : (
                calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              data-testid={`refresh-calendars-${provider}`}
              onClick={onRefreshCalendars}
              disabled={calendarsStatus === 'loading'}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
          {calendarsStatus === 'error' && (
            <p className="text-xs text-rose-300">
              Could not load your {label} calendars. Check the connection or reconnect.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Events are added to this calendar. Reminders and notifications live in the calendar.
          </p>
        </div>
      )}
    </div>
  );
}
