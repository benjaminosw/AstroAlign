'use client';

import { useEffect, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { validateCoordinates as validateCoordinateValues } from '../lib/timezone/validateCoordinates';
import AlignmentCalculator from './AlignmentCalculator';
import AlignmentFinder from './AlignmentFinder';
import FindShootingLocations from './FindShootingLocations';

type TabId = 'calculate' | 'find' | 'shooting';

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
    label: 'Find shooting locations',
    description: 'Given a target, date, Sun/Moon and rise/set event, find locations from which to shoot the aligned event.'
  }
];

export default function AlignmentApp() {
  const [activeTab, setActiveTab] = useState<TabId>('calculate');
  const [observer, setObserver] = useState<GeographicPoint>(DEFAULT_OBSERVER);
  const [target, setTarget] = useState<GeographicPoint>(DEFAULT_TARGET);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [timeZoneStatus, setTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [targetTimeZone, setTargetTimeZone] = useState<string | null>(null);
  const [targetTimeZoneStatus, setTargetTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');

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

  const activeTabInfo = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  const commonProps = {
    observer,
    target,
    timeZone,
    timeZoneStatus,
    observerCoordinateError,
    onObserverChange: handleObserverChange,
    onTargetChange: handleTargetChange
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
        <FindShootingLocations
          target={target}
          targetCoordinateError={targetCoordinateError}
          timeZone={targetTimeZone}
          timeZoneStatus={targetTimeZoneStatus}
          onTargetChange={handleTargetChange}
        />
      )}
    </div>
  );
}
