'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteSavedAlignmentRecord,
  deleteSetupRecord,
  deleteShootingLocationRecord,
  deleteTargetRecord,
  clearAllData,
  saveSavedAlignment,
  saveSetup,
  saveShootingLocation,
  saveTarget
} from '../storage/repository';
import { useOptionalAppState } from '../storage/appState';
import type {
  SavedAlignment,
  SavedPoint,
  SavedShootingLocation,
  SavedShootingGeometry,
  SavedSetup,
  SavedTarget,
  SaveAlignmentInput
} from './types';
import {
  coordinateKey,
  generatedAlignmentName,
  generatedLocationName,
  generatedTargetName,
  geometryKey,
  savedAlignmentDedupeKey
} from './types';

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
  savedAlignments: SavedAlignment[];
  addSavedAlignment: (_input: SaveAlignmentInput, _options?: { name?: string }) => SavedAlignment;
  updateSavedAlignment: (_id: string, _patch: { name?: string }) => SavedAlignment;
  deleteSavedAlignment: (_id: string) => void;
  findSavedAlignmentByDedupeKey: (_key: string) => SavedAlignment | null;
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
  const [savedAlignments, setSavedAlignments] = useState<SavedAlignment[]>([]);
  const [boundTargetId, setBoundTargetId] = useState<string | null>(null);
  const [boundShootingLocationId, setBoundShootingLocationId] = useState<string | null>(null);
  const hydratedOnceRef = useRef(false);

  const appState = useOptionalAppState();
  const hydratedData = appState?.hydratedData ?? null;

  useEffect(() => {
    if (!hydratedData || hydratedOnceRef.current) {
      return;
    }
    hydratedOnceRef.current = true;
    setTargets(hydratedData.targets);
    setShootingLocations(hydratedData.shootingLocations);
    setSetups(hydratedData.shootingSetups);
    setSavedAlignments(hydratedData.savedAlignments);
  }, [hydratedData]);

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
    void saveTarget(target).catch(() => {});
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
    void saveTarget(updated).catch(() => {});
    return updated;
  }

  function deleteTarget(id: string) {
    const affectedSetups = setups.filter((setup) => setup.targetId === id);
    setTargets((prev) => prev.filter((target) => target.id !== id));
    setSetups((prev) => prev.filter((setup) => setup.targetId !== id));
    void deleteTargetRecord(id).catch(() => {});
    for (const setup of affectedSetups) {
      void deleteSetupRecord(setup.id).catch(() => {});
    }
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
    void saveShootingLocation(location).catch(() => {});
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
    void saveShootingLocation(updated).catch(() => {});
    return updated;
  }

  function deleteShootingLocation(id: string) {
    const affectedSetups = setups.filter((setup) => setup.shootingLocationId === id);
    setShootingLocations((prev) => prev.filter((location) => location.id !== id));
    setSetups((prev) => prev.filter((setup) => setup.shootingLocationId !== id));
    void deleteShootingLocationRecord(id).catch(() => {});
    for (const setup of affectedSetups) {
      void deleteSetupRecord(setup.id).catch(() => {});
    }
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
    void saveSetup(setup).catch(() => {});
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
    void saveSetup(updated).catch(() => {});
    return updated;
  }

  function deleteSetup(id: string) {
    setSetups((prev) => prev.filter((setup) => setup.id !== id));
    void deleteSetupRecord(id).catch(() => {});
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

  function addSavedAlignment(input: SaveAlignmentInput, options?: { name?: string }): SavedAlignment {
    const dedupeKey = savedAlignmentDedupeKey(input);
    const existing = savedAlignments.find((alignment) => alignment.dedupeKey === dedupeKey);
    const now = nowIso();
    if (existing) {
      const updated: SavedAlignment = {
        ...existing,
        ...input,
        name: options?.name?.trim() || existing.name,
        dedupeKey,
        updatedAt: now
      };
      setSavedAlignments((prev) => prev.map((alignment) => (alignment.id === updated.id ? updated : alignment)));
      void saveSavedAlignment(updated).catch(() => {});
      return updated;
    }
    const alignment: SavedAlignment = {
      id: createId('alignment'),
      name: options?.name?.trim() || generatedAlignmentName(input),
      dedupeKey,
      ...input,
      createdAt: now,
      updatedAt: now
    };
    setSavedAlignments((prev) => [...prev, alignment]);
    void saveSavedAlignment(alignment).catch(() => {});
    return alignment;
  }

  function updateSavedAlignment(id: string, patch: { name?: string }): SavedAlignment {
    const existing = savedAlignments.find((alignment) => alignment.id === id);
    if (!existing) {
      throw new Error(`Saved alignment ${id} not found`);
    }
    const updated: SavedAlignment = {
      ...existing,
      name: patch.name?.trim() || existing.name,
      updatedAt: nowIso()
    };
    setSavedAlignments((prev) => prev.map((alignment) => (alignment.id === id ? updated : alignment)));
    void saveSavedAlignment(updated).catch(() => {});
    return updated;
  }

  function deleteSavedAlignment(id: string) {
    setSavedAlignments((prev) => prev.filter((alignment) => alignment.id !== id));
    void deleteSavedAlignmentRecord(id).catch(() => {});
  }

  function findSavedAlignmentByDedupeKey(key: string): SavedAlignment | null {
    return savedAlignments.find((alignment) => alignment.dedupeKey === key) ?? null;
  }

  function resetAll() {
    setTargets([]);
    setShootingLocations([]);
    setSetups([]);
    setSavedAlignments([]);
    setBoundTargetId(null);
    setBoundShootingLocationId(null);
    void clearAllData().catch(() => {});
    if (appState) {
      void appState.clearPersistedAppState().catch(() => {});
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
        savedAlignments,
        addSavedAlignment,
        updateSavedAlignment,
        deleteSavedAlignment,
        findSavedAlignmentByDedupeKey,
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
