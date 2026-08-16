'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  SavedPoint,
  SavedSetup,
  SavedShootingLocation,
  SavedShootingGeometry,
  SavedTarget
} from '../lib/saved/types';
import { useSavedLocations } from '../lib/saved/savedState';
import { validateCoordinates } from '../lib/timezone/validateCoordinates';
import SavedTargetCard from './SavedTargetCard';
import SavedLocationCard from './SavedLocationCard';
import SavedSetupCard from './SavedSetupCard';
import DataManagement from './DataManagement';

const SavedLocationMap = dynamic(() => import('./SavedLocationMap'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="saved-locations-map-loading"
      className="h-[380px] w-full rounded-2xl border border-slate-800 bg-slate-900"
    />
  )
});

export interface TargetDraft {
  kind: 'target';
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  elevation: string;
  notes: string;
}

export interface LocationDraftPoint {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
}

export interface LocationDraft {
  kind: 'shootingLocation';
  id: string;
  name: string;
  notes: string;
  type: 'point' | 'path' | 'points';
  points: LocationDraftPoint[];
}

export interface SetupDraft {
  kind: 'setup';
  id: string;
  name: string;
  targetId: string;
  shootingLocationId: string;
}

export type SavedDraft = TargetDraft | LocationDraft | SetupDraft;

interface SavedLocationsPageProps {
  onOpenTarget: (_target: SavedTarget) => void;
  onOpenSetup: (_setup: SavedSetup) => void;
}

type FilterId = 'all' | 'targets' | 'shootingLocations' | 'setups';

type Focused = { kind: 'target' | 'shootingLocation' | 'setup'; id: string };

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'targets', label: 'Targets' },
  { id: 'shootingLocations', label: 'Shooting locations' },
  { id: 'setups', label: 'Setups' }
];

function parseCoord(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function targetToDraft(target: SavedTarget): TargetDraft {
  return {
    kind: 'target',
    id: target.id,
    name: target.name,
    latitude: String(target.latitude),
    longitude: String(target.longitude),
    elevation: target.elevation === null ? '' : String(target.elevation),
    notes: target.notes
  };
}

function locationToDraft(location: SavedShootingLocation): LocationDraft {
  const geometry = location.geometry;
  if (geometry.type === 'point') {
    return {
      kind: 'shootingLocation',
      id: location.id,
      name: location.name,
      notes: location.notes,
      type: 'point',
      points: [savedPointToDraft(geometry.point)]
    };
  }
  if (geometry.type === 'path') {
    return {
      kind: 'shootingLocation',
      id: location.id,
      name: location.name,
      notes: location.notes,
      type: 'path',
      points: [savedPointToDraft(geometry.start), savedPointToDraft(geometry.end)]
    };
  }
  return {
    kind: 'shootingLocation',
    id: location.id,
    name: location.name,
    notes: location.notes,
    type: 'points',
    points: geometry.points.map(savedPointToDraft)
  };
}

function savedPointToDraft(point: SavedPoint): LocationDraftPoint {
  return {
    id: point.id,
    name: point.name,
    latitude: String(point.latitude),
    longitude: String(point.longitude)
  };
}

function setupToDraft(setup: SavedSetup): SetupDraft {
  return {
    kind: 'setup',
    id: setup.id,
    name: setup.name,
    targetId: setup.targetId,
    shootingLocationId: setup.shootingLocationId
  };
}

function locationDraftToGeometry(draft: LocationDraft, original?: SavedShootingLocation['geometry']): SavedShootingGeometry {
  const originalPoints = new Map<string, SavedPoint>();
  if (original) {
    for (const point of original.type === 'point' ? [original.point] : original.type === 'path' ? [original.start, original.end] : original.points) {
      originalPoints.set(point.id, point);
    }
  }
  const toPoint = (draftPoint: LocationDraftPoint): SavedPoint => {
    const fallback = originalPoints.get(draftPoint.id);
    return {
      id: draftPoint.id,
      name: draftPoint.name,
      latitude: parseCoord(draftPoint.latitude) ?? fallback?.latitude ?? 0,
      longitude: parseCoord(draftPoint.longitude) ?? fallback?.longitude ?? 0
    };
  };
  if (draft.type === 'point') {
    return { type: 'point', point: toPoint(draft.points[0]) };
  }
  if (draft.type === 'path') {
    return { type: 'path', start: toPoint(draft.points[0]), end: toPoint(draft.points[1]) };
  }
  return { type: 'points', points: draft.points.map(toPoint) };
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
}

export default function SavedLocationsPage({ onOpenTarget, onOpenSetup }: SavedLocationsPageProps) {
  const {
    targets,
    shootingLocations,
    setups,
    updateTarget,
    deleteTarget,
    updateShootingLocation,
    deleteShootingLocation,
    addSetup,
    updateSetup,
    deleteSetup
  } = useSavedLocations();

  const [filter, setFilter] = useState<FilterId>('all');
  const [focused, setFocused] = useState<Focused | null>(null);
  const [editDraft, setEditDraft] = useState<SavedDraft | null>(null);
  const [useWithTargetId, setUseWithTargetId] = useState<string | null>(null);
  const [useWithTargetSelection, setUseWithTargetSelection] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fitId, setFitId] = useState(0);

  const focusedTarget = focused?.kind === 'target' ? targets.find((target) => target.id === focused.id) ?? null : null;
  const focusedLocation =
    focused?.kind === 'shootingLocation'
      ? shootingLocations.find((location) => location.id === focused.id) ?? null
      : null;
  const focusedSetup = focused?.kind === 'setup' ? setups.find((setup) => setup.id === focused.id) ?? null : null;

  const useWithLocation = useWithTargetId
    ? shootingLocations.find((location) => location.id === useWithTargetId) ?? null
    : null;

  const editTarget = editDraft?.kind === 'target' ? targets.find((target) => target.id === editDraft.id) ?? null : null;
  const editLocation =
    editDraft?.kind === 'shootingLocation'
      ? shootingLocations.find((location) => location.id === editDraft.id) ?? null
      : null;
  const editSetup = editDraft?.kind === 'setup' ? setups.find((setup) => setup.id === editDraft.id) ?? null : null;

  const mapPreview = useMemo(() => {
    let mapTarget: { latitude: number; longitude: number; name?: string | null } | null = null;
    let mapLocation: { geometry: SavedShootingGeometry; name?: string | null } | null = null;
    let editable = false;

    if (editDraft?.kind === 'target' && editTarget) {
      mapTarget = {
        latitude: parseCoord(editDraft.latitude) ?? editTarget.latitude,
        longitude: parseCoord(editDraft.longitude) ?? editTarget.longitude,
        name: editDraft.name
      };
      editable = true;
    } else if (editDraft?.kind === 'shootingLocation' && editLocation) {
      mapLocation = {
        geometry: locationDraftToGeometry(editDraft, editLocation.geometry),
        name: editDraft.name
      };
      editable = true;
    } else if (editDraft?.kind === 'setup' && editSetup) {
      const target = targets.find((item) => item.id === editSetup.targetId) ?? null;
      const location = shootingLocations.find((item) => item.id === editSetup.shootingLocationId) ?? null;
      if (target) {
        mapTarget = { latitude: target.latitude, longitude: target.longitude, name: target.name };
      }
      if (location) {
        mapLocation = { geometry: location.geometry, name: location.name };
      }
    } else if (focusedTarget) {
      mapTarget = { latitude: focusedTarget.latitude, longitude: focusedTarget.longitude, name: focusedTarget.name };
    } else if (focusedLocation) {
      mapLocation = { geometry: focusedLocation.geometry, name: focusedLocation.name };
    } else if (focusedSetup) {
      const target = targets.find((item) => item.id === focusedSetup.targetId) ?? null;
      const location = shootingLocations.find((item) => item.id === focusedSetup.shootingLocationId) ?? null;
      if (target) {
        mapTarget = { latitude: target.latitude, longitude: target.longitude, name: target.name };
      }
      if (location) {
        mapLocation = { geometry: location.geometry, name: location.name };
      }
    }

    return { mapTarget, mapLocation, editable };
  }, [editDraft, editTarget, editLocation, editSetup, focusedTarget, focusedLocation, focusedSetup, targets, shootingLocations]);

  const previewKey =
    editDraft !== null
      ? `edit-${editDraft.kind}-${editDraft.id}`
      : focused
        ? `${focused.kind}-${focused.id}`
        : 'none';

  useEffect(() => {
    setFitId((value) => value + 1);
  }, [previewKey]);

  function focusItem(kind: Focused['kind'], id: string) {
    setFocused({ kind, id });
    setUseWithTargetId(null);
  }

  function handleMarkerMove(markerId: string, latitude: number, longitude: number) {
    if (editDraft?.kind === 'target') {
      setEditDraft({
        ...editDraft,
        latitude: String(latitude),
        longitude: String(longitude)
      });
      return;
    }
    if (editDraft?.kind === 'shootingLocation') {
      setEditDraft({
        ...editDraft,
        points: editDraft.points.map((point) =>
          point.id === markerId ? { ...point, latitude: String(latitude), longitude: String(longitude) } : point
        )
      });
    }
  }

  function cancelEditing() {
    setEditDraft(null);
    setSaveError(null);
  }

  function saveTargetDraft() {
    if (editDraft?.kind !== 'target') {
      return;
    }
    const latitude = parseCoord(editDraft.latitude);
    const longitude = parseCoord(editDraft.longitude);
    const error = validateCoordinates(latitude ?? Number.NaN, longitude ?? Number.NaN);
    if (error) {
      setSaveError(error);
      return;
    }
    updateTarget(editDraft.id, {
      name: editDraft.name,
      latitude: latitude!,
      longitude: longitude!,
      elevation: parseCoord(editDraft.elevation),
      notes: editDraft.notes
    });
    setNotice(`Saved target "${editDraft.name}" updated.`);
    setEditDraft(null);
  }

  function saveLocationDraft() {
    if (editDraft?.kind !== 'shootingLocation') {
      return;
    }
    for (const point of editDraft.points) {
      const latitude = parseCoord(point.latitude);
      const longitude = parseCoord(point.longitude);
      const error = validateCoordinates(latitude ?? Number.NaN, longitude ?? Number.NaN);
      if (error) {
        setSaveError(`${point.name || 'A point'} has invalid coordinates. ${error}`);
        return;
      }
    }
    updateShootingLocation(editDraft.id, {
      name: editDraft.name,
      notes: editDraft.notes,
      geometry: locationDraftToGeometry(editDraft)
    });
    setNotice(`Saved shooting location "${editDraft.name}" updated.`);
    setEditDraft(null);
  }

  function saveSetupDraft() {
    if (editDraft?.kind !== 'setup') {
      return;
    }
    updateSetup(editDraft.id, {
      name: editDraft.name,
      targetId: editDraft.targetId,
      shootingLocationId: editDraft.shootingLocationId
    });
    setNotice(`Setup "${editDraft.name}" updated.`);
    setEditDraft(null);
  }

  function handleDeleteTarget(target: SavedTarget) {
    const message = `Delete saved target "${target.name}"? Setups using this target will also be deleted.`;
    if (!window.confirm(message)) {
      return;
    }
    deleteTarget(target.id);
    setNotice(`Deleted saved target "${target.name}".`);
    clearReferences(target.id);
  }

  function handleDeleteLocation(location: SavedShootingLocation) {
    const message = `Delete saved shooting location "${location.name}"? Setups using this location will also be deleted.`;
    if (!window.confirm(message)) {
      return;
    }
    deleteShootingLocation(location.id);
    setNotice(`Deleted saved shooting location "${location.name}".`);
    clearReferences(location.id);
  }

  function handleDeleteSetup(setup: SavedSetup) {
    if (!window.confirm(`Delete saved setup "${setup.name}"?`)) {
      return;
    }
    deleteSetup(setup.id);
    setNotice(`Deleted saved setup "${setup.name}".`);
    clearReferences(setup.id);
  }

  function clearReferences(id: string) {
    if (focused?.id === id) {
      setFocused(null);
    }
    if (editDraft?.id === id) {
      setEditDraft(null);
    }
    if (useWithTargetId === id) {
      setUseWithTargetId(null);
    }
  }

  function handleCreateSetup(targetId: string, locationId: string) {
    const target = targets.find((item) => item.id === targetId);
    const location = shootingLocations.find((item) => item.id === locationId);
    const setup = addSetup({
      name: `${target?.name ?? 'Target'} · ${location?.name ?? 'Shooting area'}`,
      targetId,
      shootingLocationId: locationId
    });
    setFocused({ kind: 'setup', id: setup.id });
    setUseWithTargetId(null);
    setUseWithTargetSelection('');
    setNotice(`Setup "${setup.name}" saved.`);
  }

  function handleFindShootingOpportunities(target: SavedTarget) {
    onOpenTarget(target);
  }

  const showTargets = filter === 'all' || filter === 'targets';
  const showLocations = filter === 'all' || filter === 'shootingLocations';
  const showSetups = filter === 'all' || filter === 'setups';

  return (
    <div data-testid="saved-locations-page" className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="inline-flex flex-wrap rounded-2xl border border-slate-800 bg-slate-900 p-1" role="tablist" aria-label="Saved items">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              onClick={() => setFilter(option.id)}
              data-testid={`saved-filter-${option.id}`}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                filter === option.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {notice && (
          <div data-testid="saved-notice" className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-600 bg-emerald-950/60 p-4 text-sm text-emerald-200">
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

        {saveError && (
          <div className="rounded-2xl border border-rose-600 bg-rose-950/60 p-4 text-sm text-rose-200">{saveError}</div>
        )}

        {useWithLocation && (
          <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4" data-testid="use-with-target-panel">
            <p className="text-sm text-slate-300">
              Create a setup using shooting location <span className="font-semibold text-white">{useWithLocation.name}</span> and a
              saved target:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Select a saved target"
                value={useWithTargetSelection}
                onChange={(event) => setUseWithTargetSelection(event.target.value)}
                className="min-w-48 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="">Select a target…</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={useWithTargetSelection === ''}
                onClick={() => handleCreateSetup(useWithTargetSelection, useWithLocation.id)}
                data-testid="use-with-target-create"
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create setup
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseWithTargetId(null);
                  setUseWithTargetSelection('');
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
            {targets.length === 0 && (
              <p className="text-xs text-slate-500">
                No saved targets yet. Save a target from Find shooting opportunities first.
              </p>
            )}
          </div>
        )}

        {showTargets && (
          <section aria-label="Saved targets">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Targets ({targets.length})
            </h2>
            {targets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-4 text-sm text-slate-500">
                No saved targets yet. Use Save target in Find shooting opportunities.
              </p>
            ) : (
              <div className="space-y-3">
                {targets.map((target) => (
                  <SavedTargetCard
                    key={target.id}
                    target={target}
                    active={focused?.kind === 'target' && focused.id === target.id}
                    draft={editDraft?.kind === 'target' && editDraft.id === target.id ? editDraft : null}
                    onActivate={() => focusItem('target', target.id)}
                    onFindShootingOpportunities={() => handleFindShootingOpportunities(target)}
                    onStartEdit={() => {
                      setFocused({ kind: 'target', id: target.id });
                      setEditDraft(targetToDraft(target));
                      setSaveError(null);
                    }}
                    onDraftChange={(patch) => setEditDraft((prev) => (prev && prev.kind === 'target' ? { ...prev, ...patch } : prev))}
                    onSaveDraft={saveTargetDraft}
                    onCancelDraft={cancelEditing}
                    onDelete={() => handleDeleteTarget(target)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showLocations && (
          <section aria-label="Saved shooting locations">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Shooting locations ({shootingLocations.length})
            </h2>
            {shootingLocations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-4 text-sm text-slate-500">
                No saved shooting locations yet. Use Save shooting location in Find shooting opportunities.
              </p>
            ) : (
              <div className="space-y-3">
                {shootingLocations.map((location) => (
                  <SavedLocationCard
                    key={location.id}
                    location={location}
                    active={focused?.kind === 'shootingLocation' && focused.id === location.id}
                    draft={editDraft?.kind === 'shootingLocation' && editDraft.id === location.id ? editDraft : null}
                    onActivate={() => focusItem('shootingLocation', location.id)}
                    onUseWithTarget={() => {
                      setUseWithTargetId(location.id);
                      setUseWithTargetSelection('');
                    }}
                    onStartEdit={() => {
                      setFocused({ kind: 'shootingLocation', id: location.id });
                      setEditDraft(locationToDraft(location));
                      setSaveError(null);
                    }}
                    onDraftChange={(patch) =>
                      setEditDraft((prev) => (prev && prev.kind === 'shootingLocation' ? { ...prev, ...patch } : prev))
                    }
                    onDraftPointChange={(pointId, patch) =>
                      setEditDraft((prev) =>
                        prev && prev.kind === 'shootingLocation'
                          ? {
                              ...prev,
                              points: prev.points.map((point) => (point.id === pointId ? { ...point, ...patch } : point))
                            }
                          : prev
                      )
                    }
                    onSaveDraft={saveLocationDraft}
                    onCancelDraft={cancelEditing}
                    onDelete={() => handleDeleteLocation(location)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showSetups && (
          <section aria-label="Saved setups">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Setups ({setups.length})
            </h2>
            {setups.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-4 text-sm text-slate-500">
                No saved setups yet. Combine a saved target and shooting location, or use Save as setup in Find shooting
                opportunities.
              </p>
            ) : (
              <div className="space-y-3">
                {setups.map((setup) => {
                  const target = targets.find((item) => item.id === setup.targetId);
                  const location = shootingLocations.find((item) => item.id === setup.shootingLocationId);
                  return (
                    <SavedSetupCard
                      key={setup.id}
                      setup={setup}
                      targetName={target?.name ?? 'Deleted target'}
                      locationName={location?.name ?? 'Deleted location'}
                      active={focused?.kind === 'setup' && focused.id === setup.id}
                      draft={editDraft?.kind === 'setup' && editDraft.id === setup.id ? editDraft : null}
                      targets={targets}
                      shootingLocations={shootingLocations}
                      onActivate={() => focusItem('setup', setup.id)}
                      onOpen={() => onOpenSetup(setup)}
                      onStartEdit={() => {
                        setFocused({ kind: 'setup', id: setup.id });
                        setEditDraft(setupToDraft(setup));
                        setSaveError(null);
                      }}
                      onDraftChange={(patch) =>
                        setEditDraft((prev) => (prev && prev.kind === 'setup' ? { ...prev, ...patch } : prev))
                      }
                      onSaveDraft={saveSetupDraft}
                      onCancelDraft={cancelEditing}
                      onDelete={() => handleDeleteSetup(setup)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {targets.length === 0 && shootingLocations.length === 0 && setups.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-500">
            Nothing saved yet. Save targets, shooting locations, and setups from the Find shooting opportunities tab, and
            they will appear here — even after a refresh.
          </p>
        )}

        <DataManagement />
      </div>

      <div className="lg:sticky lg:top-8">
        <SavedLocationMap
          target={mapPreview.mapTarget}
          shootingLocation={mapPreview.mapLocation}
          editable={mapPreview.editable}
          onMarkerMove={handleMarkerMove}
          fitId={fitId}
        />
        <p className="mt-2 text-xs text-slate-500">
          {mapPreview.editable
            ? 'Drag markers on the map to fine-tune coordinates.'
            : focused
              ? 'Click Edit on a card to fine-tune its geometry on the map.'
              : 'Open a saved item to preview it here.'}
        </p>
        {focusedSetup && !editDraft && (
          <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">{focusedSetup.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {focusedTarget?.name ?? 'Target'} → {focusedLocation?.name ?? 'Shooting location'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatUpdated(focusedSetup.updatedAt)}</p>
          </div>
        )}
        {focusedTarget && !editDraft && (
          <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">{focusedTarget.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {focusedTarget.latitude.toFixed(6)}, {focusedTarget.longitude.toFixed(6)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatUpdated(focusedTarget.updatedAt)}</p>
          </div>
        )}
        {focusedLocation && !editDraft && (
          <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">{focusedLocation.name}</p>
            <p className="mt-1 text-xs text-slate-400">{focusedLocation.geometry.type}</p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatUpdated(focusedLocation.updatedAt)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
