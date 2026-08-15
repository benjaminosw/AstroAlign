'use client';

import { createContext, useContext, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ASTRO_OBJECT } from '../../types/astronomy';
import type { AstroObject, GeographicPoint } from '../../types/astronomy';
import type { TimeFilterOption } from '../alignment/timeFilter';
import type { ShootingArea, ShootingOpportunity } from './types';
import { MOON_PHASE_BUCKETS } from '../astronomy/lunarPhase';

export interface SearchedInputs {
  target: GeographicPoint;
  object: AstroObject;
  eventType: 'rise' | 'set';
  startDate: string | null;
  endDate: string | null;
  toleranceDegrees: number;
  area: ShootingArea;
  landmarkName: string | null;
}

export interface ShootingViewport {
  longitude: number;
  latitude: number;
  zoom: number;
}

export type ShootingStatus = 'idle' | 'running' | 'completed';

export const ALL_MOON_PHASES = MOON_PHASE_BUCKETS.map((bucket) => bucket.name);

interface ShootingStateValue {
  object: AstroObject;
  eventType: 'rise' | 'set';
  startDate: string | null;
  endDate: string | null;
  toleranceDegrees: number;
  area: ShootingArea | null;
  areaTouched: boolean;
  fullMoonOnly: boolean;
  timeFilter: TimeFilterOption;
  customStartTime: string;
  customEndTime: string;
  selectedMoonPhases: string[];
  allOpportunities: ShootingOpportunity[] | null;
  status: ShootingStatus;
  progress: number;
  error: string | null;
  lastSearchedInputs: SearchedInputs | null;
  selectedId: string | null;
  viewport: ShootingViewport | null;
  setObject: (_value: AstroObject) => void;
  setEventType: (_value: 'rise' | 'set') => void;
  setStartDate: (_value: string | null) => void;
  setEndDate: (_value: string | null) => void;
  setToleranceDegrees: (_value: number) => void;
  setArea: (_value: ShootingArea) => void;
  setAreaTouched: (_value: boolean) => void;
  setFullMoonOnly: (_value: boolean) => void;
  setTimeFilter: (_value: TimeFilterOption) => void;
  setCustomStartTime: (_value: string) => void;
  setCustomEndTime: (_value: string) => void;
  setSelectedMoonPhases: Dispatch<SetStateAction<string[]>>;
  setAllOpportunities: (_value: ShootingOpportunity[] | null) => void;
  setStatus: (_value: ShootingStatus) => void;
  setProgress: (_value: number) => void;
  setError: (_value: string | null) => void;
  setLastSearchedInputs: (_value: SearchedInputs | null) => void;
  setSelectedId: (_value: string | null) => void;
  setViewport: (_value: ShootingViewport | null) => void;
  resetFilters: () => void;
}

const ShootingStateContext = createContext<ShootingStateValue | null>(null);

export function ShootingStateProvider({ children }: { children: ReactNode }) {
  const [object, setObject] = useState<AstroObject>(ASTRO_OBJECT.Sun);
  const [eventType, setEventType] = useState<'rise' | 'set'>('rise');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [toleranceDegrees, setToleranceDegrees] = useState(0.5);
  const [area, setArea] = useState<ShootingArea | null>(null);
  const [areaTouched, setAreaTouched] = useState(false);
  const [fullMoonOnly, setFullMoonOnly] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>('any');
  const [customStartTime, setCustomStartTime] = useState('18:00');
  const [customEndTime, setCustomEndTime] = useState('07:00');
  const [selectedMoonPhases, setSelectedMoonPhases] = useState<string[]>(ALL_MOON_PHASES);
  const [allOpportunities, setAllOpportunities] = useState<ShootingOpportunity[] | null>(null);
  const [status, setStatus] = useState<ShootingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSearchedInputs, setLastSearchedInputs] = useState<SearchedInputs | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ShootingViewport | null>(null);

  function resetFilters() {
    setSelectedMoonPhases(ALL_MOON_PHASES);
    setTimeFilter('any');
    setCustomStartTime('18:00');
    setCustomEndTime('07:00');
    setFullMoonOnly(false);
  }

  return (
    <ShootingStateContext.Provider
      value={{
        object,
        eventType,
        startDate,
        endDate,
        toleranceDegrees,
        area,
        areaTouched,
        fullMoonOnly,
        timeFilter,
        customStartTime,
        customEndTime,
        selectedMoonPhases,
        allOpportunities,
        status,
        progress,
        error,
        lastSearchedInputs,
        selectedId,
        viewport,
        setObject,
        setEventType,
        setStartDate,
        setEndDate,
        setToleranceDegrees,
        setArea,
        setAreaTouched,
        setFullMoonOnly,
        setTimeFilter,
        setCustomStartTime,
        setCustomEndTime,
        setSelectedMoonPhases,
        setAllOpportunities,
        setStatus,
        setProgress,
        setError,
        setLastSearchedInputs,
        setSelectedId,
        setViewport,
        resetFilters
      }}
    >
      {children}
    </ShootingStateContext.Provider>
  );
}

export function useShootingState(): ShootingStateValue {
  const context = useContext(ShootingStateContext);
  if (!context) {
    throw new Error('useShootingState must be used within a ShootingStateProvider');
  }
  return context;
}
