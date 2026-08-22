'use client';

import { useState } from 'react';
import type { SavedAlignment } from '../lib/saved/types';
import type { CalendarAlignmentInfo } from '../lib/calendar/types';
import CalendarExportControl from './CalendarExportControl';

interface SavedAlignmentCardProps {
  alignment: SavedAlignment;
  targetName: string | null;
  onRename: (_name: string) => void;
  onDelete: () => void;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

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
  onDelete
}: SavedAlignmentCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(alignment.name);

  const calendarInfo: CalendarAlignmentInfo | null = alignment.timeZone
    ? {
        object: alignment.object,
        event: alignment.event,
        date: alignment.date,
        time: alignment.time,
        timeZone: alignment.timeZone,
        alignmentErrorDegrees: alignment.alignmentError,
        celestialAzimuth: alignment.celestialAzimuth,
        targetBearing: alignment.targetBearing,
        moonPhase: alignment.moonPhase ?? null,
        targetName,
        observer: alignment.observerSnapshot
          ? { latitude: alignment.observerSnapshot.latitude, longitude: alignment.observerSnapshot.longitude }
          : null,
        targetPoint: alignment.targetSnapshot
          ? { latitude: alignment.targetSnapshot.latitude, longitude: alignment.targetSnapshot.longitude }
          : null,
        shootingPosition: alignment.shootingPositionSnapshot
          ? {
              latitude: alignment.shootingPositionSnapshot.latitude,
              longitude: alignment.shootingPositionSnapshot.longitude,
              bearingToTarget: alignment.shootingPositionSnapshot.bearingToTarget,
              distanceFromStartKm:
                alignment.shootingPositionSnapshot.source === 'path'
                  ? alignment.shootingPositionSnapshot.distanceFromStartKm ?? null
                  : null,
              pointName: alignment.shootingPositionSnapshot.pointName ?? null
            }
          : null
      }
    : null;

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

          <div className="flex flex-wrap items-start gap-2">
            {calendarInfo && (
              <div className="w-44">
                <CalendarExportControl
                  testId={`saved-alignment-calendar-${alignment.id}`}
                  triggerLabel={'\u{1F4C5} Save to Calendar'}
                  events={[calendarInfo]}
                />
              </div>
            )}
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
