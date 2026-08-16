'use client';

import { useState } from 'react';
import type { SavedAlignment } from '../lib/saved/types';
import type { CalendarIntegrationEntry } from '../lib/saved/types';
import type { ExternalCalendarProvider } from '../lib/calendar/types';
import { calendarSyncStatus } from '../lib/calendar/types';
import { useCalendar } from '../lib/calendar/CalendarProvider';
import { useSavedLocations } from '../lib/saved/savedState';

interface SavedAlignmentCardProps {
  alignment: SavedAlignment;
  targetName: string | null;
  onRename: (_name: string) => void;
  onDelete: () => void;
  onGoToSettings?: () => void;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

const PROVIDER_LABELS: Record<ExternalCalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Calendar'
};

function sourceLabel(source: SavedAlignment['source']): string {
  if (source === 'finder') {
    return 'Found';
  }
  if (source === 'shooting') {
    return 'Shooting';
  }
  return 'Calculated';
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
}

export default function SavedAlignmentCard({
  alignment,
  targetName,
  onRename,
  onDelete,
  onGoToSettings = () => {}
}: SavedAlignmentCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(alignment.name);

  function saveName() {
    onRename(name.trim());
    setEditing(false);
  }

  return (
    <div data-testid={`saved-alignment-card-${alignment.id}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      {editing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Rename alignment</p>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {sourceLabel(alignment.source)}
            </span>
          </div>
          <div>
            <label htmlFor={`saved-alignment-${alignment.id}-name`} className="text-sm text-slate-300">
              Name
            </label>
            <input
              id={`saved-alignment-${alignment.id}-name`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveName}
              data-testid={`saved-alignment-save-${alignment.id}`}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => {
                setName(alignment.name);
                setEditing(false);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">{alignment.event === null ? '◎' : alignment.event === 'rise' ? '↑' : '↓'}</span>
              <h3 className="truncate text-sm font-semibold text-white">{alignment.name}</h3>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {sourceLabel(alignment.source)}
            </span>
          </div>

          <p className="text-sm text-slate-200">
            {alignment.object} · {alignment.date} · {alignment.time}
            {alignment.timeZone ? <span className="text-slate-500"> · {alignment.timeZone}</span> : null}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Celestial azimuth</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                {alignment.celestialAzimuth.toFixed(2)}°
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Target bearing</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{alignment.targetBearing.toFixed(2)}°</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Difference</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{alignment.alignmentError.toFixed(2)}°</p>
            </div>
          </div>

          {targetName && <p className="text-xs text-slate-400">Target: {targetName}</p>}

          {alignment.shootingPositionSnapshot && (
            <p className="text-xs text-slate-400">
              Shooting position: {alignment.shootingPositionSnapshot.latitude.toFixed(5)},{' '}
              {alignment.shootingPositionSnapshot.longitude.toFixed(5)} · Bearing{' '}
              {alignment.shootingPositionSnapshot.bearingToTarget.toFixed(2)}°
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {alignment.withinTolerance !== null && alignment.withinTolerance !== undefined && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  alignment.withinTolerance
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {alignment.withinTolerance
                  ? `✓ Within ${alignment.toleranceDegrees ?? ''}°`.replace('°°', '°')
                  : `⚠ Outside ${alignment.toleranceDegrees ?? ''}°`.replace('°°', '°')}{' '}
                tolerance
              </span>
            )}
            {alignment.moonPhase && (
              <span
                className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300"
                title={alignment.moonPhase.name}
              >
                <span aria-hidden="true">{alignment.moonPhase.emoji}</span> {alignment.moonPhase.name}
              </span>
            )}
            <span className="text-xs text-slate-500">Updated {formatUpdated(alignment.updatedAt)}</span>
          </div>

          <CalendarActions
            alignment={alignment}
            targetName={targetName}
            onGoToSettings={onGoToSettings}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setName(alignment.name);
                setEditing(true);
              }}
              data-testid={`saved-alignment-edit-${alignment.id}`}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={onDelete}
              data-testid={`saved-alignment-delete-${alignment.id}`}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-500 hover:text-rose-200"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CalendarActionsProps {
  alignment: SavedAlignment;
  targetName: string | null;
  onGoToSettings: () => void;
}

function CalendarActions({ alignment, targetName, onGoToSettings }: CalendarActionsProps) {
  const calendar = useCalendar();
  const { setSavedAlignmentCalendarIntegration } = useSavedLocations();
  const [busy, setBusy] = useState<ExternalCalendarProvider | 'ics' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { connections, calendars, selectedGoogleCalendarId, selectedMicrosoftCalendarId, reminderDefault } = calendar;

  const googleConnected = connections.google.connected;
  const microsoftConnected = connections.microsoft.connected;

  function calendarIdFor(provider: ExternalCalendarProvider): string | null {
    const options = calendars[provider];
    const selected = provider === 'google' ? selectedGoogleCalendarId : selectedMicrosoftCalendarId;
    if (selected && options.some((option) => option.id === selected)) {
      return selected;
    }
    return options[0]?.id ?? null;
  }

  async function handleAdd(provider: ExternalCalendarProvider) {
    setBusy(provider);
    setActionError(null);
    setActionSuccess(null);
    const calendarId = calendarIdFor(provider);
    if (!calendarId) {
      setActionError(`Choose a ${PROVIDER_LABELS[provider]} calendar in Settings first.`);
      setBusy(null);
      return;
    }
    try {
      const result = await calendar.createEvent(provider, {
        alignment,
        targetName,
        calendarId,
        reminderMinutes: reminderDefault
      });
      const entry: CalendarIntegrationEntry = {
        calendarId: result.calendarId,
        eventId: result.eventId,
        eventUrl: result.eventUrl,
        lastSyncedAt: new Date().toISOString()
      };
      setSavedAlignmentCalendarIntegration(alignment.id, provider, entry);
      setActionSuccess(`Added to ${PROVIDER_LABELS[provider]}.`);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(provider: ExternalCalendarProvider) {
    const integration = alignment.calendarIntegrations?.[provider];
    if (!integration) {
      return;
    }
    setBusy(provider);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await calendar.updateEvent(provider, {
        alignment,
        targetName,
        integration,
        reminderMinutes: reminderDefault
      });
      const entry: CalendarIntegrationEntry = {
        calendarId: result.calendarId,
        eventId: result.eventId,
        eventUrl: result.eventUrl,
        lastSyncedAt: new Date().toISOString()
      };
      setSavedAlignmentCalendarIntegration(alignment.id, provider, entry);
      setActionSuccess(`Updated in ${PROVIDER_LABELS[provider]}.`);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function handleExportIcs() {
    setBusy('ics');
    setActionError(null);
    setActionSuccess(null);
    calendar.exportToIcs(alignment, targetName, reminderDefault);
    setActionSuccess('Exported .ics file — import it into your calendar app.');
    setBusy(null);
  }

  if (!googleConnected && !microsoftConnected) {
    return (
      <div className="space-y-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          data-testid={`calendar-add-${alignment.id}`}
          onClick={onGoToSettings}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          📅 Add to Calendar
        </button>
        <button
          type="button"
          data-testid={`calendar-ics-${alignment.id}`}
          disabled={busy === 'ics'}
          onClick={handleExportIcs}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          📄 Export .ics
        </button>
        {actionError && (
          <p data-testid={`calendar-error-${alignment.id}`} className="text-xs text-rose-300">
            {actionError}
          </p>
        )}
        {actionSuccess && (
          <p data-testid={`calendar-success-${alignment.id}`} className="text-xs text-emerald-300">
            {actionSuccess}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      {(['google', 'microsoft'] as ExternalCalendarProvider[]).map((provider) => {
        const integration = alignment.calendarIntegrations?.[provider];
        const status = calendarSyncStatus(alignment, provider, connections[provider].connected);
        return (
          <div key={provider} data-testid={`calendar-provider-row-${provider}-${alignment.id}`} className="flex flex-wrap items-center gap-2">
            {status === 'not-exported' && (
              <button
                type="button"
                data-testid={`calendar-add-${provider}-${alignment.id}`}
                disabled={busy === provider}
                onClick={() => void handleAdd(provider)}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                📅 Add to {PROVIDER_LABELS[provider]}
              </button>
            )}
            {status === 'exported' && (
              <>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  ✓ {PROVIDER_LABELS[provider]}
                </span>
                {integration?.eventUrl && (
                  <a
                    href={integration.eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`calendar-open-${provider}-${alignment.id}`}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Open in {provider === 'google' ? 'Google Calendar' : 'Outlook'}
                  </a>
                )}
                <button
                  type="button"
                  data-testid={`calendar-update-${provider}-${alignment.id}`}
                  disabled={busy === provider}
                  onClick={() => void handleUpdate(provider)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Update event
                </button>
              </>
            )}
            {status === 'out-of-sync' && (
              <>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  ⚠ {PROVIDER_LABELS[provider]} event needs updating
                </span>
                <button
                  type="button"
                  data-testid={`calendar-update-${provider}-${alignment.id}`}
                  disabled={busy === provider}
                  onClick={() => void handleUpdate(provider)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Update event
                </button>
                {integration?.eventUrl && (
                  <a
                    href={integration.eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Open
                  </a>
                )}
              </>
            )}
            {!connections[provider].connected && (
              <button
                type="button"
                onClick={onGoToSettings}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Connect {PROVIDER_LABELS[provider]}…
              </button>
            )}
            {integration && (
              <span className="text-[11px] text-slate-500">Last synced {formatUpdated(integration.lastSyncedAt)}</span>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={`calendar-ics-${alignment.id}`}
          disabled={busy === 'ics'}
          onClick={handleExportIcs}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          📄 Export .ics
        </button>
        <span className="text-[11px] text-slate-500">ICS exports can only be imported, not synced back.</span>
      </div>
      {actionError && (
        <p data-testid={`calendar-error-${alignment.id}`} className="text-xs text-rose-300">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p data-testid={`calendar-success-${alignment.id}`} className="text-xs text-emerald-300">
          {actionSuccess}
        </p>
      )}
    </div>
  );
}
