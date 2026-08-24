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
import ReverseAlignment from './ReverseAlignment';
import SavedLocationsPage from './SavedLocationsPage';
import SavedAlignmentsPage from './SavedAlignmentsPage';
import { ShootingStateProvider, useShootingState } from '../lib/opportunities/shootingState';
import { SavedLocationsProvider, useSavedLocations } from '../lib/saved/savedState';
import { AppStateProvider, useAppState, usePersistedState } from '../lib/storage/appState';
import type { SavedSetup, SavedTarget } from '../lib/saved/types';
import { geometryToShootingArea, targetToLandmark } from '../lib/saved/types';

type TabId = 'calculate' | 'find' | 'shooting' | 'reverse' | 'saved' | 'alignments';

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
    id: 'reverse',
    label: 'Reverse alignment',
    description: 'Given a target and a Sun/Moon rise/set event, find the direction from the target where an observer would have stood.'
  },
  {
    id: 'saved',
    label: 'Saved locations',
    description: 'Manage saved targets, shooting locations, and setups — preserved between sessions.'
  },
  {
    id: 'alignments',
    label: 'Saved alignments',
    description: 'Review alignments you have calculated or found and saved — preserved between sessions.'
  }
];

function AlignmentAppContent() {
  const [activeTab, setActiveTab] = usePersistedState<TabId>('app.activeTab', 'calculate');
  const [observer, setObserver] = usePersistedState<GeographicPoint>('app.observer', DEFAULT_OBSERVER);
  const [target, setTarget] = usePersistedState<GeographicPoint>('app.target', DEFAULT_TARGET);
  const [observerLandmark, setObserverLandmark] = usePersistedState<SelectedLandmark | null>(
    'app.observerLandmark',
    null
  );
  const [targetLandmark, setTargetLandmark] = usePersistedState<SelectedLandmark | null>(
    'app.targetLandmark',
    null
  );
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
    onClearLandmark: handleClearLandmark,
    onGoToSavedLocations: () => setActiveTab('saved')
  };

  return (
    <div className="grid gap-8">
      <div className="min-w-0">
        <div className="flex min-w-0">
          <div
            className="inline-flex max-w-full flex-wrap rounded-2xl border border-slate-800 bg-slate-900 p-1"
            role="tablist"
            aria-label="Alignment tools"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${
                  activeTab === tab.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-md text-sm text-slate-400">{activeTabInfo.description}</p>
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
      {activeTab === 'reverse' && (
        <ReverseAlignment
          target={target}
          landmark={targetLandmark}
          targetCoordinateError={targetCoordinateError}
          timeZone={targetTimeZone}
          timeZoneStatus={targetTimeZoneStatus}
          onTargetChange={handleTargetChange}
          onSelectLandmark={handleSelectLandmark}
          onClearLandmark={handleClearLandmark}
        />
      )}
      {activeTab === 'saved' && (
        <SavedLocationsPage onOpenTarget={handleOpenSavedTarget} onOpenSetup={handleOpenSavedSetup} />
      )}
      {activeTab === 'alignments' && <SavedAlignmentsPage />}
    </div>
  );
}

function AppLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="text-sm text-slate-400">Loading your saved data…</div>
    </div>
  );
}

export default function AlignmentApp() {
  return (
    <AppStateProvider>
      <AppGate />
    </AppStateProvider>
  );
}

function AppGate() {
  const { isHydrated, persistenceError } = useAppState();
  if (!isHydrated) {
    return <AppLoading />;
  }
  return (
    <ShootingStateProvider>
      <SavedLocationsProvider>
        <div className="grid gap-8">
          {persistenceError && (
            <div className="rounded-2xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
              {persistenceError}
            </div>
          )}
          <AlignmentAppContent />
        </div>
      </SavedLocationsProvider>
    </ShootingStateProvider>
  );
}
