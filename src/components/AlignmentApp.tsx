'use client';

import { useEffect, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import type { SelectedLandmark } from '../lib/geocoding/types';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { validateCoordinates as validateCoordinateValues } from '../lib/timezone/validateCoordinates';
import AlignmentCalculator from './AlignmentCalculator';
import AlignmentFinder from './AlignmentFinder';
import FindShootingOpportunities from './FindShootingOpportunities';
import SavedLocationsPage from './SavedLocationsPage';
import { ShootingStateProvider, useShootingState } from '../lib/opportunities/shootingState';
import { SavedLocationsProvider, useSavedLocations } from '../lib/saved/savedState';
import type { SavedSetup, SavedTarget } from '../lib/saved/types';
import { geometryToShootingArea, targetToLandmark } from '../lib/saved/types';

type TabId = 'calculate' | 'find' | 'shooting' | 'saved';

const TABS: Array<{ id: TabId; label: string; description: string }> = [
  {
    id: 'calculate',
    label: 'Calculate alignment',
    description: 'Check how closely the Sun or Moon lines up with your target at a chosen date and time.'
  },
  {
    id: 'find',
    label: 'Find alignments',
    description: 'Search Sun/Moon rise and set events that align with your target across a date range.'
  },
  {
    id: 'shooting',
    label: 'Find shooting opportunities',
    description: 'Search across a date range and a shooting area for Sun/Moon rise and set events that align with your target.'
  },
  {
    id: 'saved',
    label: 'Saved locations',
    description: 'Manage saved targets, shooting locations, and setups — preserved between sessions.'
  }
];

function AlignmentAppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('calculate');
  const [observer, setObserver] = useState<GeographicPoint>(DEFAULT_OBSERVER);
  const [target, setTarget] = useState<GeographicPoint>(DEFAULT_TARGET);
  const [observerLandmark, setObserverLandmark] = useState<SelectedLandmark | null>(null);
  const [targetLandmark, setTargetLandmark] = useState<SelectedLandmark | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [timeZoneStatus, setTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [targetTimeZone, setTargetTimeZone] = useState<string | null>(null);
  const [targetTimeZoneStatus, setTargetTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const { setArea, setAreaTouched } = useShootingState();
  const { targets, shootingLocations, bindTarget, bindShootingLocation } = useSavedLocations();

  const observerCoordinateError = validateCoordinateValues(observer.latitude, observer.longitude);
  const targetCoordinateError = validateCoordinateValues(target.latitude, target.longitude);

  useEffect(() => {
    const error = validateCoordinateValues(observer.latitude, observer.longitude);

    if (error) {
      setTimeZoneStatus('idle');
      setTimeZone(null);
      return;
    }

    setTimeZoneStatus('loading');
    const handler = window.setTimeout(() => {
      try {
        const lookup = getTimezoneFromCoordinates(observer.latitude, observer.longitude);
        setTimeZone(lookup.timeZone);
        setTimeZoneStatus('idle');
      } catch {
        setTimeZone(null);
        setTimeZoneStatus('error');
      }
    }, 250);

    return () => window.clearTimeout(handler);
  }, [observer.latitude, observer.longitude]);

  useEffect(() => {
    const error = validateCoordinateValues(target.latitude, target.longitude);

    if (error) {
      setTargetTimeZoneStatus('idle');
      setTargetTimeZone(null);
      return;
    }

    setTargetTimeZoneStatus('loading');
    const handler = window.setTimeout(() => {
      try {
        const lookup = getTimezoneFromCoordinates(target.latitude, target.longitude);
        setTargetTimeZone(lookup.timeZone);
        setTargetTimeZoneStatus('idle');
      } catch {
        setTargetTimeZone(null);
        setTargetTimeZoneStatus('error');
      }
    }, 250);

    return () => window.clearTimeout(handler);
  }, [target.latitude, target.longitude]);

  function handleObserverChange(field: keyof GeographicPoint, value: string) {
    setObserver((prev) => ({ ...prev, [field]: Number(value) }));
  }

  function handleTargetChange(field: keyof GeographicPoint, value: string) {
    setTarget((prev) => ({ ...prev, [field]: Number(value) }));
  }

  function handleSelectObserverLandmark(landmark: SelectedLandmark) {
    setObserver((prev) => ({ ...prev, latitude: landmark.latitude, longitude: landmark.longitude }));
    setObserverLandmark(landmark);
  }

  function handleClearObserverLandmark() {
    setObserverLandmark(null);
  }

  function handleSelectLandmark(landmark: SelectedLandmark) {
    setTarget((prev) => ({ ...prev, latitude: landmark.latitude, longitude: landmark.longitude }));
    setTargetLandmark(landmark);
  }

  function handleClearLandmark() {
    setTargetLandmark(null);
  }

  function handleOpenSavedTarget(savedTarget: SavedTarget) {
    setTarget({
      latitude: savedTarget.latitude,
      longitude: savedTarget.longitude,
      elevation: savedTarget.elevation ?? 0
    });
    setTargetLandmark(targetToLandmark(savedTarget));
    bindTarget(savedTarget.id);
    setActiveTab('shooting');
  }

  function handleOpenSavedSetup(setup: SavedSetup) {
    const savedTarget = targets.find((target) => target.id === setup.targetId);
    const savedLocation = shootingLocations.find((location) => location.id === setup.shootingLocationId);
    if (savedTarget) {
      setTarget({
        latitude: savedTarget.latitude,
        longitude: savedTarget.longitude,
        elevation: savedTarget.elevation ?? 0
      });
      setTargetLandmark(targetToLandmark(savedTarget));
      bindTarget(savedTarget.id);
    }
    if (savedLocation) {
      setArea(geometryToShootingArea(savedLocation.geometry));
      setAreaTouched(true);
      bindShootingLocation(savedLocation.id);
    }
    setActiveTab('shooting');
  }

  const activeTabInfo = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  const commonProps = {
    observer,
    target,
    observerLandmark,
    landmark: targetLandmark,
    timeZone,
    timeZoneStatus,
    observerCoordinateError,
    onObserverChange: handleObserverChange,
    onTargetChange: handleTargetChange,
    onSelectObserverLandmark: handleSelectObserverLandmark,
    onSelectLandmark: handleSelectLandmark,
    onClearObserverLandmark: handleClearObserverLandmark,
    onClearLandmark: handleClearLandmark
  };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900 p-1" role="tablist" aria-label="Alignment tools">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-6 ${
                activeTab === tab.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="max-w-md text-sm text-slate-400">{activeTabInfo.description}</p>
      </div>

      {activeTab === 'calculate' && <AlignmentCalculator {...commonProps} />}
      {activeTab === 'find' && <AlignmentFinder {...commonProps} />}
      {activeTab === 'shooting' && (
        <FindShootingOpportunities
          target={target}
          landmark={targetLandmark}
          targetCoordinateError={targetCoordinateError}
          timeZone={targetTimeZone}
          timeZoneStatus={targetTimeZoneStatus}
          onTargetChange={handleTargetChange}
          onSelectLandmark={handleSelectLandmark}
          onClearLandmark={handleClearLandmark}
          onGoToSavedLocations={() => setActiveTab('saved')}
        />
      )}
      {activeTab === 'saved' && (
        <SavedLocationsPage onOpenTarget={handleOpenSavedTarget} onOpenSetup={handleOpenSavedSetup} />
      )}
    </div>
  );
}

export default function AlignmentApp() {
  return (
    <ShootingStateProvider>
      <SavedLocationsProvider>
        <AlignmentAppContent />
      </SavedLocationsProvider>
    </ShootingStateProvider>
  );
}
