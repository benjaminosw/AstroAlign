'use client';

import { useMemo, useState } from 'react';
import { useSavedLocations } from '../lib/saved/savedState';
import { useCalendar } from '../lib/calendar/CalendarProvider';
import type { SavedAlignment } from '../lib/saved/types';
import type { ExternalCalendarProvider } from '../lib/calendar/types';
import SavedAlignmentCard from './SavedAlignmentCard';

interface SavedAlignmentsPageProps {
  onGoToSettings?: () => void;
}

type TimeFilter = 'all' | 'upcoming' | 'past';

const FILTERS: Array<{ id: TimeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' }
];

const PROVIDER_LABELS: Record<ExternalCalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Calendar'
};

function localNowDateTimeString(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}:${pad(now.getSeconds())}`;
}

function alignmentDateTimeString(alignment: SavedAlignment): string {
  const time = alignment.time.length === 5 ? `${alignment.time}:00` : alignment.time;
  return `${alignment.date}T${time}`;
}

export default function SavedAlignmentsPage({ onGoToSettings = () => {} }: SavedAlignmentsPageProps) {
  const { savedAlignments, targets, updateSavedAlignment, deleteSavedAlignment } = useSavedLocations();
  const calendar = useCalendar();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success');
  const [filter, setFilter] = useState<TimeFilter>('all');
  const [deleting, setDeleting] = useState<SavedAlignment | null>(null);
  const [removeFromCalendar, setRemoveFromCalendar] = useState(false);

  const sortedAlignments = useMemo(
    () =>
      [...savedAlignments].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return b.time.localeCompare(a.time);
      }),
    [savedAlignments]
  );

  const nowDateTime = localNowDateTimeString();

  const visibleAlignments = useMemo(() => {
    if (filter === 'all') {
      return sortedAlignments;
    }
    const isUpcoming = filter === 'upcoming';
    return sortedAlignments.filter((alignment) => {
      const comparable = alignmentDateTimeString(alignment);
      return isUpcoming ? comparable >= nowDateTime : comparable < nowDateTime;
    });
  }, [sortedAlignments, filter, nowDateTime]);

  function showNotice(message: string, kind: 'success' | 'error' = 'success') {
    setNoticeKind(kind);
    setNotice(message);
  }

  function handleRename(alignment: SavedAlignment, name: string) {
    updateSavedAlignment(alignment.id, { name });
    showNotice(`Renamed alignment to "${name}".`);
  }

  function integrationsFor(alignment: SavedAlignment): ExternalCalendarProvider[] {
    const integrations = alignment.calendarIntegrations ?? {};
    return (['google', 'microsoft'] as ExternalCalendarProvider[]).filter((provider) => integrations[provider]);
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }
    if (removeFromCalendar) {
      for (const provider of integrationsFor(deleting)) {
        const integration = deleting.calendarIntegrations?.[provider];
        if (!integration) {
          continue;
        }
        try {
          await calendar.deleteEvent(provider, integration);
        } catch (error) {
          showNotice(
            `Could not remove the event from ${PROVIDER_LABELS[provider]}: ${(error as Error).message}. The alignment was not deleted.`,
            'error'
          );
          return;
        }
      }
    }
    deleteSavedAlignment(deleting.id);
    showNotice(`Deleted saved alignment "${deleting.name}".`);
    setDeleting(null);
    setRemoveFromCalendar(false);
  }

  const removableProviders = deleting ? integrationsFor(deleting) : [];

  return (
    <div data-testid="saved-alignments-page" className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
          Saved alignments ({savedAlignments.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Alignments you saved from Calculate alignment, Find alignments, or Find shooting opportunities — preserved
          between sessions.
        </p>
      </div>

      {notice && (
        <div
          data-testid="saved-alignments-notice"
          className={`flex items-start justify-between gap-2 rounded-2xl border p-4 text-sm ${
            noticeKind === 'error'
              ? 'border-rose-600 bg-rose-950/60 text-rose-200'
              : 'border-emerald-600 bg-emerald-950/60 text-emerald-200'
          }`}
        >
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="rounded-lg px-2 py-0.5 text-lg leading-none transition hover:bg-slate-900 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {deleting && (
        <div data-testid="delete-alignment-confirm" className="rounded-2xl border border-rose-700 bg-rose-950/30 p-4">
          <p className="text-sm font-semibold text-white">Delete saved alignment?</p>
          <p className="mt-1 text-sm text-slate-300">{`\u201C${deleting.name}\u201D`}</p>
          {removableProviders.length > 0 && (
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200">
              <input
                type="checkbox"
                data-testid="delete-remove-from-calendar"
                checked={removeFromCalendar}
                onChange={(event) => setRemoveFromCalendar(event.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
              />
              Also remove the event{removableProviders.length > 1 ? 's' : ''} from{' '}
              {removableProviders.map((provider) => PROVIDER_LABELS[provider]).join(' and ')}
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              data-testid="confirm-delete-alignment"
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-rose-500"
            >
              {removeFromCalendar ? 'Delete and remove from calendar' : 'Delete alignment'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleting(null);
                setRemoveFromCalendar(false);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sortedAlignments.length > 0 && (
        <div
          className="inline-flex flex-wrap rounded-2xl border border-slate-800 bg-slate-900 p-1"
          role="tablist"
          aria-label="Saved alignments filter"
        >
          {FILTERS.map((option) => {
            const count =
              option.id === 'all'
                ? sortedAlignments.length
                : option.id === 'upcoming'
                  ? sortedAlignments.filter((alignment) => alignmentDateTimeString(alignment) >= nowDateTime).length
                  : sortedAlignments.filter((alignment) => alignmentDateTimeString(alignment) < nowDateTime).length;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                onClick={() => setFilter(option.id)}
                data-testid={`alignments-filter-${option.id}`}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  filter === option.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {sortedAlignments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
          No saved alignments yet. Use Save alignment on a calculated alignment, a found alignment, or a shooting
          opportunity — they will appear here, even after a refresh.
        </p>
      ) : visibleAlignments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
          No {filter === 'upcoming' ? 'upcoming' : 'past'} alignments.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleAlignments.map((alignment) => {
            const target = alignment.targetId
              ? (targets.find((item) => item.id === alignment.targetId) ?? null)
              : null;
            const targetName = target?.name ?? (alignment.targetSnapshot?.name ?? null);
            return (
              <SavedAlignmentCard
                key={alignment.id}
                alignment={alignment}
                targetName={targetName}
                onRename={(name) => handleRename(alignment, name)}
                onDelete={() => {
                  setDeleting(alignment);
                  setRemoveFromCalendar(false);
                }}
                onGoToSettings={onGoToSettings}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
