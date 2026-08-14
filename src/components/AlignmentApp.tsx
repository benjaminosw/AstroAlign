'use client';

import { useEffect, useState } from 'react';
import type { GeographicPoint } from '../types/astronomy';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../lib/constants/defaultCoordinates';
import { getTimezoneFromCoordinates } from '../lib/timezone/getTimezoneFromCoordinates';
import { getLocalDateTimeForTimeZone } from '../lib/timezone/getLocalDateTimeForTimeZone';
import { formatTimezoneLabel } from '../lib/timezone/formatTimezoneLabel';
import { validateCoordinates as validateCoordinateValues } from '../lib/timezone/validateCoordinates';
import AlignmentCalculator from './AlignmentCalculator';
import AlignmentFinder from './AlignmentFinder';

type TabId = 'calculate' | 'find';

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
  }
];

function NumberField({ label, fieldValue, onChange, placeholder }: { label: string; fieldValue: string; onChange: (_value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        type="number"
        value={fieldValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step="any"
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />
    </label>
  );
}

export default function AlignmentApp() {
  const [activeTab, setActiveTab] = useState<TabId>('calculate');
  const [observer, setObserver] = useState<GeographicPoint>(DEFAULT_OBSERVER);
  const [target, setTarget] = useState<GeographicPoint>(DEFAULT_TARGET);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [timeZoneStatus, setTimeZoneStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const observerCoordinateError = validateCoordinateValues(observer.latitude, observer.longitude);

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

  function handleObserverChange(field: keyof GeographicPoint, value: string) {
    setObserver((prev) => ({ ...prev, [field]: Number(value) }));
  }

  function handleTargetChange(field: keyof GeographicPoint, value: string) {
    setTarget((prev) => ({ ...prev, [field]: Number(value) }));
  }

  const localNow = timeZone ? getLocalDateTimeForTimeZone(timeZone) : null;
  const formattedTimezone = timeZone && localNow ? formatTimezoneLabel(localNow.date, localNow.time, timeZone) : null;

  const activeTabInfo = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-white">Observer</h2>
            {observerCoordinateError ? (
              <span className="text-xs text-rose-300">{observerCoordinateError}</span>
            ) : timeZoneStatus === 'loading' ? (
              <span className="text-xs text-slate-400">Detecting timezone…</span>
            ) : timeZoneStatus === 'error' ? (
              <span className="text-xs text-rose-300">Timezone unavailable</span>
            ) : formattedTimezone ? (
              <span
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200"
                title="Automatically detected from observer location"
              >
                {formattedTimezone}
              </span>
            ) : (
              <span className="text-xs text-slate-500">Enter valid coordinates to detect timezone</span>
            )}
          </div>
          <NumberField label="Latitude" fieldValue={String(observer.latitude)} onChange={(value) => handleObserverChange('latitude', value)} />
          <NumberField label="Longitude" fieldValue={String(observer.longitude)} onChange={(value) => handleObserverChange('longitude', value)} />
          <NumberField label="Elevation (m)" fieldValue={String(observer.elevation)} onChange={(value) => handleObserverChange('elevation', value)} />
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-xl font-semibold text-white">Target</h2>
          <NumberField label="Latitude" fieldValue={String(target.latitude)} onChange={(value) => handleTargetChange('latitude', value)} />
          <NumberField label="Longitude" fieldValue={String(target.longitude)} onChange={(value) => handleTargetChange('longitude', value)} />
          <NumberField label="Elevation (m)" fieldValue={String(target.elevation)} onChange={(value) => handleTargetChange('elevation', value)} />
        </section>
      </div>

      {activeTab === 'calculate' ? (
        <AlignmentCalculator
          observer={observer}
          target={target}
          timeZone={timeZone}
          timeZoneStatus={timeZoneStatus}
          observerCoordinateError={observerCoordinateError}
        />
      ) : (
        <AlignmentFinder
          observer={observer}
          target={target}
          timeZone={timeZone}
          timeZoneStatus={timeZoneStatus}
          observerCoordinateError={observerCoordinateError}
        />
      )}
    </div>
  );
}
