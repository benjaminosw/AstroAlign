'use client';

import type { AstroObject, GeographicPoint } from '../types/astronomy';
import type { ShootingOpportunity } from '../lib/opportunities/types';
import { formatResultDate } from '../lib/utils/formatResultDate';
import SaveAlignmentControl from './SaveAlignmentControl';
import SaveAllAlignmentsControl from './SaveAllAlignmentsControl';
import CalendarExportControl from './CalendarExportControl';
import type { SavedAlignmentShootingLocationSnapshot, SaveAlignmentInput } from '../lib/saved/types';
import type { CalendarAlignmentInfo } from '../lib/calendar/types';

interface ShootingOpportunityResultsProps {
  allResults: ShootingOpportunity[] | null;
  visibleResults: ShootingOpportunity[];
  searchedObject: AstroObject;
  filtersActive: boolean;
  isCurrent: boolean;
  selectedId: string | null;
  onSelect: (_id: string) => void;
  onResetFilters: () => void;
  selectedOpportunity?: ShootingOpportunity | null;
  target?: GeographicPoint | null;
  targetName?: string | null;
  toleranceDegrees?: number;
  targetId?: string | null;
  shootingSetupId?: string | null;
  shootingLocationSnapshot?: SavedAlignmentShootingLocationSnapshot | null;
}

function positionLabel(opportunity: ShootingOpportunity): string {
  if (opportunity.position.source === 'point') {
    return opportunity.position.pointName || 'Shooting point';
  }
  return `${opportunity.position.distanceFromStartKm.toFixed(2)} km from start`;
}

function positionHint(opportunity: ShootingOpportunity): string {
  if (opportunity.position.source === 'path') {
    return `Valid zone ${opportunity.position.zoneStartKm.toFixed(2)}–${opportunity.position.zoneEndKm.toFixed(2)} km from start`;
  }
  return 'Point on shooting area';
}

export default function ShootingOpportunityResults({
  allResults,
  visibleResults,
  searchedObject,
  filtersActive,
  isCurrent,
  selectedId,
  onSelect,
  onResetFilters,
  selectedOpportunity = null,
  target = null,
  targetName = null,
  toleranceDegrees = 0,
  targetId = null,
  shootingSetupId = null,
  shootingLocationSnapshot = null
}: ShootingOpportunityResultsProps) {
  const totalCount = allResults?.length ?? 0;
  const shownCount = visibleResults.length;

  function opportunityToCalendarInfo(opportunity: ShootingOpportunity): CalendarAlignmentInfo {
    return {
      object: opportunity.object,
      event: opportunity.eventType,
      date: opportunity.localDate,
      time: opportunity.localTime,
      timeZone: opportunity.timeZone,
      alignmentErrorDegrees: opportunity.position.alignmentError,
      celestialAzimuth: opportunity.objectAzimuth,
      targetBearing: opportunity.position.bearingToTarget,
      moonPhase: opportunity.moonPhase ?? null,
      moonIlluminationPercent: opportunity.moonIlluminationPercent ?? null,
      targetName,
      targetPoint: target ? { latitude: target.latitude, longitude: target.longitude } : null,
      shootingPosition: {
        latitude: opportunity.position.latitude,
        longitude: opportunity.position.longitude,
        bearingToTarget: opportunity.position.bearingToTarget,
        distanceFromStartKm:
          opportunity.position.source === 'path' ? opportunity.position.distanceFromStartKm : null,
        pointName: opportunity.position.pointName ?? null
      },
      objectAltitudeDeg: opportunity.objectAltitude
    };
  }

  function opportunityToSaveInput(opportunity: ShootingOpportunity): SaveAlignmentInput {
    return {
      source: 'shooting',
      object: opportunity.object,
      event: opportunity.eventType,
      date: opportunity.localDate,
      time: opportunity.localTime,
      timeZone: opportunity.timeZone ?? null,
      celestialAzimuth: opportunity.objectAzimuth,
      targetBearing: opportunity.position.bearingToTarget,
      alignmentError: opportunity.position.alignmentError,
      toleranceDegrees,
      withinTolerance: opportunity.position.alignmentError <= toleranceDegrees,
      moonPhase: opportunity.moonPhase ?? null,
      targetId: targetId ?? null,
      shootingSetupId: shootingSetupId ?? null,
      observerSnapshot: null,
      targetSnapshot: target
        ? { latitude: target.latitude, longitude: target.longitude, elevation: target.elevation }
        : null,
      shootingPositionSnapshot: {
        latitude: opportunity.position.latitude,
        longitude: opportunity.position.longitude,
        bearingToTarget: opportunity.position.bearingToTarget,
        alignmentError: opportunity.position.alignmentError,
        distanceFromStartKm: opportunity.position.distanceFromStartKm,
        zoneStartKm: opportunity.position.zoneStartKm,
        zoneEndKm: opportunity.position.zoneEndKm,
        source: opportunity.position.source,
        pointName: opportunity.position.pointName ?? null
      },
      shootingLocationSnapshot: shootingLocationSnapshot ?? null
    };
  }

  return (
    <section data-testid="shooting-opportunity-results" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Shooting opportunities</h2>
        <div className="flex flex-wrap items-center gap-3">
          {allResults !== null && (
            <p data-testid="opportunities-count" className="text-sm font-semibold text-white">
              {shownCount !== totalCount || filtersActive
                ? `${totalCount} opportunities found · ${shownCount} shown`
                : `${shownCount} opportunit${shownCount === 1 ? 'y' : 'ies'}`}
            </p>
          )}
          {visibleResults.length > 0 && (
            <>
              <SaveAllAlignmentsControl inputs={visibleResults.map(opportunityToSaveInput)} />
              <CalendarExportControl
                testId="opportunity-calendar-bulk"
                triggerLabel={'\u{1F4C5} Save All to Calendar'}
                events={visibleResults.map(opportunityToCalendarInfo)}
              />
            </>
          )}
        </div>
      </div>

      <p data-testid="geometric-alignment-note" className="mt-3 text-xs leading-relaxed text-slate-500">
        Geometric alignment only — not checked for accessibility, roads, obstructions, terrain, visibility or legal
        access.
      </p>

      {selectedOpportunity && (
        <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-300">
              <p className="font-semibold text-white">
                {selectedOpportunity.eventLabel} · {formatResultDate(selectedOpportunity.localDate)} ·{' '}
                {selectedOpportunity.localTime}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {positionLabel(selectedOpportunity)} · Bearing{' '}
                {selectedOpportunity.position.bearingToTarget.toFixed(2)}° · Δ{' '}
                {selectedOpportunity.position.alignmentError.toFixed(2)}°
              </p>
            </div>
            <div className="grid w-full gap-2 sm:w-48">
              <SaveAlignmentControl
                source="shooting"
                object={selectedOpportunity.object}
                event={selectedOpportunity.eventType}
                date={selectedOpportunity.localDate}
                time={selectedOpportunity.localTime}
                timeZone={selectedOpportunity.timeZone}
                celestialAzimuth={selectedOpportunity.objectAzimuth}
                targetBearing={selectedOpportunity.position.bearingToTarget}
                alignmentError={selectedOpportunity.position.alignmentError}
                toleranceDegrees={toleranceDegrees}
                withinTolerance={selectedOpportunity.position.alignmentError <= toleranceDegrees}
                moonPhase={selectedOpportunity.moonPhase ?? null}
                targetId={targetId}
                shootingSetupId={shootingSetupId}
                observer={null}
                target={target}
                shootingPosition={{
                  latitude: selectedOpportunity.position.latitude,
                  longitude: selectedOpportunity.position.longitude,
                  bearingToTarget: selectedOpportunity.position.bearingToTarget,
                  alignmentError: selectedOpportunity.position.alignmentError,
                  distanceFromStartKm: selectedOpportunity.position.distanceFromStartKm,
                  zoneStartKm: selectedOpportunity.position.zoneStartKm,
                  zoneEndKm: selectedOpportunity.position.zoneEndKm,
                  source: selectedOpportunity.position.source,
                  pointName: selectedOpportunity.position.pointName ?? null
                }}
                shootingLocationSnapshot={shootingLocationSnapshot}
              />
              <CalendarExportControl
                testId="opportunity-calendar-export"
                triggerLabel={'\u{1F4C5} Calendar'}
                events={[opportunityToCalendarInfo(selectedOpportunity)]}
              />
            </div>
          </div>
        </div>
      )}

      {allResults !== null && !isCurrent && (
        <div
          role="status"
          className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
        >
          ⚠ Inputs changed — search again to update these results. The map shows the last searched opportunity.
        </div>
      )}

      {allResults === null ? (
        <p className="mt-4 text-sm text-slate-500">Results will appear here after you search.</p>
      ) : allResults.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No shooting opportunities found within the selected date range and tolerance.
        </p>
      ) : searchedObject === 'Moon' && visibleResults.length === 0 && totalCount > 0 && shownCount === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm font-medium text-slate-200">No results match the current filters.</p>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount} opportunit{totalCount === 1 ? 'y was' : 'ies were'} calculated.
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : visibleResults.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm font-medium text-slate-200">No results match the current filters.</p>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount} opportunit{totalCount === 1 ? 'y was' : 'ies were'} calculated.
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-800 p-1.5">
          {visibleResults.map((opportunity, index) => (
            <button
              key={`${opportunity.id}-${index}`}
              type="button"
              data-testid="opportunity-result-item"
              aria-pressed={opportunity.id === selectedId}
              onClick={() => onSelect(opportunity.id)}
              className={`grid w-full items-center gap-x-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                opportunity.moonPhase
                  ? 'grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_1.5rem]'
                  : 'grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)]'
              } ${
                opportunity.id === selectedId
                  ? 'bg-violet-500/15 text-white ring-1 ring-violet-400/70'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span aria-hidden="true" className="text-center">
                {opportunity.eventType === 'rise' ? '↑' : '↓'}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{opportunity.eventLabel}</span>
                <span className="block whitespace-nowrap text-xs tabular-nums text-slate-400">
                  {formatResultDate(opportunity.localDate)} · {opportunity.localTime}
                </span>
              </span>
              <span className="min-w-0 text-right" title={positionHint(opportunity)}>
                <span className="block truncate font-medium text-slate-200">{positionLabel(opportunity)}</span>
                <span className="block whitespace-nowrap text-xs tabular-nums text-slate-400">
                  Alignment error: {opportunity.position.alignmentError.toFixed(2)}°
                </span>
              </span>
              {opportunity.moonPhase && (
                <span
                  data-testid="opportunity-moon-phase"
                  data-phase-name={opportunity.moonPhase.name}
                  className="whitespace-nowrap text-right tabular-nums text-slate-400"
                  title={opportunity.moonPhase.name}
                >
                  <span aria-hidden="true">{opportunity.moonPhase.emoji}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
