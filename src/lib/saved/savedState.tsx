'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  SavedPoint,
  SavedShootingLocation,
  SavedShootingGeometry,
  SavedSetup,
  SavedTarget
} from './types';
import { coordinateKey, generatedLocationName, generatedTargetName, geometryKey } from './types';

const TARGETS_KEY = 'astroalign.saved.targets';
const LOCATIONS_KEY = 'astroalign.saved.locations';
const SETUPS_KEY = 'astroalign.saved.setups';

interface StoredCollection<T> {
  version: 1;
  items: T[];
}

function loadCollection<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredCollection<T>;
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function persistCollection<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') {
    return;
  }
  const payload: StoredCollection<T> = { version: 1, items };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage unavailable; keep in-memory state.
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface NewTargetInput {
  name?: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  notes?: string;
}

export interface NewShootingLocationInput {
  name?: string;
  geometry: SavedShootingGeometry;
  notes?: string;
}

export interface NewSetupInput {
  name?: string;
  targetId: string;
  shootingLocationId: string;
}

export interface SavedLocationsValue {
  targets: SavedTarget[];
  shootingLocations: SavedShootingLocation[];
  setups: SavedSetup[];
  addTarget: (_input: NewTargetInput) => SavedTarget;
  updateTarget: (_id: string, _patch: Partial<NewTargetInput>) => SavedTarget;
  deleteTarget: (_id: string) => void;
  addShootingLocation: (_input: NewShootingLocationInput) => SavedShootingLocation;
  updateShootingLocation: (_id: string, _patch: Partial<NewShootingLocationInput>) => SavedShootingLocation;
  deleteShootingLocation: (_id: string) => void;
  addSetup: (_input: NewSetupInput) => SavedSetup;
  updateSetup: (_id: string, _patch: Partial<NewSetupInput>) => SavedSetup;
  deleteSetup: (_id: string) => void;
  findTargetByCoordinates: (_latitude: number, _longitude: number) => SavedTarget | null;
  findShootingLocationByGeometryKey: (_key: string) => SavedShootingLocation | null;
  boundTargetId: string | null;
  boundShootingLocationId: string | null;
  bindTarget: (_id: string | null) => void;
  bindShootingLocation: (_id: string | null) => void;
  resetAll: () => void;
}

const SavedLocationsContext = createContext<SavedLocationsValue | null>(null);

export function SavedLocationsProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<SavedTarget[]>([]);
  const [shootingLocations, setShootingLocations] = useState<SavedShootingLocation[]>([]);
  const [setups, setSetups] = useState<SavedSetup[]>([]);
  const [boundTargetId, setBoundTargetId] = useState<string | null>(null);
  const [boundShootingLocationId, setBoundShootingLocationId] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      return;
    }
    persistCollection(TARGETS_KEY, targets);
  }, [targets]);

  useEffect(() => {
    if (!loadedRef.current) {
      return;
    }
    persistCollection(LOCATIONS_KEY, shootingLocations);
  }, [shootingLocations]);

  useEffect(() => {
    if (!loadedRef.current) {
      return;
    }
    persistCollection(SETUPS_KEY, setups);
  }, [setups]);

  useEffect(() => {
    setTargets(loadCollection<SavedTarget>(TARGETS_KEY));
    setShootingLocations(loadCollection<SavedShootingLocation>(LOCATIONS_KEY));
    setSetups(loadCollection<SavedSetup>(SETUPS_KEY));
    loadedRef.current = true;
  }, []);

  function addTarget(input: NewTargetInput): SavedTarget {
    const now = nowIso();
    const target: SavedTarget = {
      id: createId('target'),
      name: input.name?.trim() || generatedTargetName(input),
      latitude: input.latitude,
      longitude: input.longitude,
      elevation: input.elevation ?? null,
      notes: input.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now
    };
    setTargets((prev) => [...prev, target]);
    return target;
  }

  function updateTarget(id: string, patch: Partial<NewTargetInput>): SavedTarget {
    const existing = targets.find((target) => target.id === id);
    if (!existing) {
      throw new Error(`Saved target ${id} not found`);
    }
    const updated: SavedTarget = {
      ...existing,
      ...(patch.latitude !== undefined ? { latitude: patch.latitude } : {}),
      ...(patch.longitude !== undefined ? { longitude: patch.longitude } : {}),
      ...(patch.elevation !== undefined ? { elevation: patch.elevation } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
      updatedAt: nowIso()
    };
    setTargets((prev) => prev.map((target) => (target.id === id ? updated : target)));
    return updated;
  }

  function deleteTarget(id: string) {
    setTargets((prev) => prev.filter((target) => target.id !== id));
    setSetups((prev) => prev.filter((setup) => setup.targetId !== id));
    if (boundTargetId === id) {
      setBoundTargetId(null);
    }
  }

  function addShootingLocation(input: NewShootingLocationInput): SavedShootingLocation {
    const now = nowIso();
    const location: SavedShootingLocation = {
      id: createId('location'),
      name: input.name?.trim() || generatedLocationName(input.geometry),
      geometry: input.geometry,
      notes: input.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now
    };
    setShootingLocations((prev) => [...prev, location]);
    return location;
  }

  function updateShootingLocation(id: string, patch: Partial<NewShootingLocationInput>): SavedShootingLocation {
    const existing = shootingLocations.find((location) => location.id === id);
    if (!existing) {
      throw new Error(`Saved shooting location ${id} not found`);
    }
    const updated: SavedShootingLocation = {
      ...existing,
      ...(patch.geometry !== undefined ? { geometry: patch.geometry } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
      updatedAt: nowIso()
    };
    setShootingLocations((prev) => prev.map((location) => (location.id === id ? updated : location)));
    return updated;
  }

  function deleteShootingLocation(id: string) {
    setShootingLocations((prev) => prev.filter((location) => location.id !== id));
    setSetups((prev) => prev.filter((setup) => setup.shootingLocationId !== id));
    if (boundShootingLocationId === id) {
      setBoundShootingLocationId(null);
    }
  }

  function addSetup(input: NewSetupInput): SavedSetup {
    const now = nowIso();
    const setup: SavedSetup = {
      id: createId('setup'),
      name: input.name?.trim() || 'Setup',
      targetId: input.targetId,
      shootingLocationId: input.shootingLocationId,
      createdAt: now,
      updatedAt: now
    };
    setSetups((prev) => [...prev, setup]);
    return setup;
  }

  function updateSetup(id: string, patch: Partial<NewSetupInput>): SavedSetup {
    const existing = setups.find((setup) => setup.id === id);
    if (!existing) {
      throw new Error(`Saved setup ${id} not found`);
    }
    const updated: SavedSetup = {
      ...existing,
      ...(patch.targetId !== undefined ? { targetId: patch.targetId } : {}),
      ...(patch.shootingLocationId !== undefined ? { shootingLocationId: patch.shootingLocationId } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
      updatedAt: nowIso()
    };
    setSetups((prev) => prev.map((setup) => (setup.id === id ? updated : setup)));
    return updated;
  }

  function deleteSetup(id: string) {
    setSetups((prev) => prev.filter((setup) => setup.id !== id));
  }

  function findTargetByCoordinates(latitude: number, longitude: number): SavedTarget | null {
    const key = coordinateKey(latitude, longitude);
    return (
      [...targets]
        .filter((target) => coordinateKey(target.latitude, target.longitude) === key)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null
    );
  }

  function findShootingLocationByGeometryKey(key: string): SavedShootingLocation | null {
    return (
      [...shootingLocations]
        .filter((location) => geometryKey(location.geometry) === key)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null
    );
  }

  function resetAll() {
    setTargets([]);
    setShootingLocations([]);
    setSetups([]);
    setBoundTargetId(null);
    setBoundShootingLocationId(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TARGETS_KEY);
      window.localStorage.removeItem(LOCATIONS_KEY);
      window.localStorage.removeItem(SETUPS_KEY);
    }
  }

  return (
    <SavedLocationsContext.Provider
      value={{
        targets,
        shootingLocations,
        setups,
        addTarget,
        updateTarget,
        deleteTarget,
        addShootingLocation,
        updateShootingLocation,
        deleteShootingLocation,
        addSetup,
        updateSetup,
        deleteSetup,
        findTargetByCoordinates,
        findShootingLocationByGeometryKey,
        boundTargetId,
        boundShootingLocationId,
        bindTarget: setBoundTargetId,
        bindShootingLocation: setBoundShootingLocationId,
        resetAll
      }}
    >
      {children}
    </SavedLocationsContext.Provider>
  );
}

export function useSavedLocations(): SavedLocationsValue {
  const context = useContext(SavedLocationsContext);
  if (!context) {
    throw new Error('useSavedLocations must be used within a SavedLocationsProvider');
  }
  return context;
}

export function pointIds(geometry: SavedShootingGeometry): string[] {
  if (geometry.type === 'point') {
    return [geometry.point.id];
  }
  if (geometry.type === 'path') {
    return [geometry.start.id, geometry.end.id];
  }
  return geometry.points.map((point: SavedPoint) => point.id);
}
