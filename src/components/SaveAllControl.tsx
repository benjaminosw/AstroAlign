'use client';

import { useMemo, useState } from 'react';
import { useSavedLocations } from '../lib/saved/savedState';
import { useCalendar } from '../lib/calendar/CalendarProvider';
import { savedAlignmentDedupeKey } from '../lib/saved/types';
import type { SaveAlignmentInput, SavedAlignment } from '../lib/saved/types';
import type { ExternalCalendarProvider } from '../lib/calendar/types';

export interface SaveAllItem {
  input: SaveAlignmentInput;
  targetName: string | null;
  name?: string;
}

interface SaveAllControlProps {
  items: SaveAllItem[];
  onGoToSettings: () => void;
}

const PROVIDER_LABELS: Record<ExternalCalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Calendar'
};

function savedAlignmentDedupeKeyFor(input: SaveAlignmentInput): string {
  return savedAlignmentDedupeKey({
    source: input.source,
    object: input.object,
    event: input.event,
    date: input.date,
    time: input.time,
    celestialAzimuth: input.celestialAzimuth
  });
}

export default function SaveAllControl({ items, onGoToSettings }: SaveAllControlProps) {
  const { addSavedAlignment, findSavedAlignmentByDedupeKey, setSavedAlignmentCalendarIntegration } =
    useSavedLocations();
  const calendar = useCalendar();
  const [justSavedKeys, setJustSavedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<'save' | 'calendar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);

  const savedItems = useMemo(() => {
    return items.map((item) => ({ item, existing: findSavedAlignmentByDedupeKey(savedAlignmentDedupeKeyFor(item.input)) }));
  }, [items, findSavedAlignmentByDedupeKey]);

  const remainingCount = useMemo(() => {
    return savedItems.filter(({ item, existing }) => existing === null && !justSavedKeys.has(savedAlignmentDedupeKeyFor(item.input))).length;
  }, [savedItems, justSavedKeys]);

  const hasSaved = savedItems.some(({ existing }) => existing !== null);

  const googleCalendarId =
    calendar.selectedGoogleCalendarId && calendar.calendars.google.some((option) => option.id === calendar.selectedGoogleCalendarId)
      ? calendar.selectedGoogleCalendarId
      : calendar.calendars.google[0]?.id ?? null;
  const microsoftCalendarId =
    calendar.selectedMicrosoftCalendarId &&
    calendar.calendars.microsoft.some((option) => option.id === calendar.selectedMicrosoftCalendarId)
      ? calendar.selectedMicrosoftCalendarId
      : calendar.calendars.microsoft[0]?.id ?? null;

  const availableProvider: ExternalCalendarProvider | null = calendar.connections.google.connected
    ? 'google'
    : calendar.connections.microsoft.connected
      ? 'microsoft'
      : null;

  function calendarIdFor(provider: ExternalCalendarProvider): string | null {
    return provider === 'google' ? googleCalendarId : microsoftCalendarId;
  }

  async function handleSaveAll() {
    setBusy('save');
    setError(null);
    setNotice(null);
    let count = 0;
    const keys = new Set(justSavedKeys);
    for (const { item, existing } of savedItems) {
      const key = savedAlignmentDedupeKeyFor(item.input);
      if (existing !== null || keys.has(key)) {
        continue;
      }
      addSavedAlignment(item.input, item.name ? { name: item.name } : undefined);
      keys.add(key);
      count += 1;
    }
    setJustSavedKeys(keys);
    setNotice(
      count === 0
        ? 'All visible alignments were already saved.'
        : `Saved ${count} of ${items.length} visible alignment${count === 1 ? '' : 's'}.`
    );
    setBusy(null);
  }

  async function handleAddAllToCalendar() {
    setBusy('calendar');
    setError(null);
    setNotice(null);
    const provider = availableProvider;
    if (!provider) {
      setError('Connect a calendar in Settings first.');
      setBusy(null);
      return;
    }
    const calendarId = calendarIdFor(provider);
    if (!calendarId) {
      setError(`Choose a ${provider === 'google' ? 'Google' : 'Microsoft'} calendar in Settings first.`);
      setBusy(null);
      return;
    }

    const targets: Array<{ alignment: SavedAlignment; item: SaveAllItem }> = [];
    for (const { item, existing } of savedItems) {
      if (existing) {
        targets.push({ alignment: existing, item });
      }
    }

    let added = 0;
    let failed = 0;
    for (const { alignment, item } of targets) {
      if (alignment.calendarIntegrations?.[provider]) {
        continue;
      }
      try {
        const result = await calendar.createEvent(provider, {
          alignment,
          targetName: item.targetName,
          calendarId,
          reminderMinutes: calendar.reminderDefault
        });
        setSavedAlignmentCalendarIntegration(alignment.id, provider, {
          calendarId: result.calendarId,
          eventId: result.eventId,
          eventUrl: result.eventUrl,
          lastSyncedAt: new Date().toISOString()
        });
        added += 1;
      } catch (catchError) {
        failed += 1;
      }
    }
    setFailedCount(failed);
    if (failed > 0) {
      setNotice(`${added} added to ${PROVIDER_LABELS[provider]}. ${failed} could not be added.`);
    } else {
      setNotice(`${added === targets.length ? `All ${added}` : `${added}`} added to ${PROVIDER_LABELS[provider]}.`);
    }
    setBusy(null);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="save-all-button"
          onClick={() => void handleSaveAll()}
          disabled={busy !== null || remainingCount === 0}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            remainingCount === 0 && hasSaved
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
          }`}
        >
          {busy === 'save'
            ? 'Saving…'
            : remainingCount === 0 && hasSaved
              ? 'All visible saved ✓'
              : `Save all (${remainingCount})`}
        </button>
        {availableProvider ? (
          <button
            type="button"
            data-testid="add-all-to-calendar-button"
            onClick={() => void handleAddAllToCalendar()}
            disabled={busy !== null || !hasSaved}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === 'calendar' ? 'Adding…' : `Add all to ${PROVIDER_LABELS[availableProvider]}`}
          </button>
        ) : (
          <button
            type="button"
            data-testid="connect-calendar-button"
            onClick={onGoToSettings}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Connect calendar to add all…
          </button>
        )}
      </div>
      {notice && (
        <p data-testid="save-all-notice" className="text-xs text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p data-testid="save-all-error" className="text-xs text-rose-300">
          {error}
        </p>
      )}
      {failedCount > 0 && busy !== 'calendar' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-amber-300">Retry the failed calendar additions?</p>
          <button
            type="button"
            data-testid="retry-calendar-button"
            onClick={() => void handleAddAllToCalendar()}
            className="rounded-lg border border-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            Retry ({failedCount})
          </button>
        </div>
      )}
    </div>
  );
}
