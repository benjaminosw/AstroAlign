'use client';

import { getAlignmentStars } from '../lib/alignment/alignmentQuality';
import type { ReverseSearchResult } from '../lib/reverseSearch/types';

interface ShootingLocationResultsProps {
  result: ReverseSearchResult | null;
  isCurrent: boolean;
  selectedId: string | null;
  onSelect: (_id: string) => void;
}

function eventLabel(result: ReverseSearchResult): string {
  const arrow = result.event.type === 'rise' ? '↑' : '↓';
  return `${arrow} ${result.event.body}${result.event.type}`;
}

export default function ShootingLocationResults({ result, isCurrent, selectedId, onSelect }: ShootingLocationResultsProps) {
  const selected = result?.candidates.find((candidate) => candidate.id === selectedId) ?? result?.candidates[0] ?? null;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Best shooting locations</p>
        {result !== null && <p className="text-2xl font-semibold text-white">{result.candidates.length} potential locations</p>}
      </div>

      <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <p className="font-semibold">Geometric alignment only</p>
        <p className="mt-1 text-amber-200/80">
          Candidate locations are checked for bearing alignment only. They have not been checked for accessibility,
          roads, obstructions, terrain, visibility or legal access.
        </p>
      </div>

      {result !== null && (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <p className="font-semibold text-white">
            {eventLabel(result)} · {result.event.localDate} · {result.event.localTime}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {result.event.body} {result.event.type === 'rise' ? 'rise' : 'set'} azimuth{' '}
            <span className="tabular-nums text-slate-200">{result.event.azimuth.toFixed(3)}°</span> at target
            {result.event.body === 'Moon' && (
              <>
                {' '}
                · Full Moon window: {result.event.withinFullMoonWindow ? 'yes' : 'no'}
              </>
            )}
          </p>
        </div>
      )}

      {result === null ? (
        <p className="mt-4 text-sm text-slate-500">Results will appear here after you search.</p>
      ) : result.candidates.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No candidate locations within the selected radius satisfy the alignment tolerance.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)]">
          <div className="space-y-2">
            {result.candidates.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelect(candidate.id)}
                aria-pressed={candidate.id === selectedId}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  candidate.id === selectedId
                    ? 'border-amber-400/60 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">#{index + 1}</span>
                  <span className="text-amber-300">{getAlignmentStars(candidate.alignmentError)}</span>
                  <span className="tabular-nums font-semibold text-emerald-300">
                    {candidate.alignmentError.toFixed(3)}°
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  <span className="tabular-nums">{candidate.distanceKm.toFixed(2)} km</span> from target
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-3 rounded-2xl bg-slate-900/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Shooting location</p>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-slate-400">Distance</p>
                  <p className="font-semibold tabular-nums text-white">{selected.distanceKm.toFixed(3)} km</p>
                </div>
                <div>
                  <p className="text-slate-400">Camera coordinates</p>
                  <p className="font-semibold tabular-nums text-white">
                    {selected.latitude.toFixed(6)}
                    <br />
                    {selected.longitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Bearing to target</p>
                  <p className="font-semibold tabular-nums text-white">{selected.bearingToTarget.toFixed(3)}°</p>
                </div>
                <div>
                  <p className="text-slate-400">Ideal azimuth</p>
                  <p className="font-semibold tabular-nums text-white">{result.idealTargetBearing.toFixed(3)}°</p>
                </div>
                <div>
                  <p className="text-slate-400">{result.event.body} {result.event.type} time</p>
                  <p className="font-semibold tabular-nums text-white">{result.event.localTime}</p>
                </div>
                <div>
                  <p className="text-slate-400">{result.event.body} {result.event.type} azimuth</p>
                  <p className="font-semibold tabular-nums text-white">{result.event.azimuth.toFixed(3)}°</p>
                </div>
                <div>
                  <p className="text-slate-400">Alignment error</p>
                  <p className="font-semibold tabular-nums text-emerald-300">{selected.alignmentError.toFixed(3)}°</p>
                </div>
                <div>
                  <p className="text-slate-400">Target altitude</p>
                  <p className="font-semibold tabular-nums text-white">
                    {selected.targetAltitude === null ? '—' : `${selected.targetAltitude.toFixed(3)}°`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {result !== null && !isCurrent && (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300"
        >
          ⚠ Inputs changed — search again to update these results
        </div>
      )}
    </section>
  );
}
