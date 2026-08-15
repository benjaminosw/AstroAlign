'use client';

import { useRef } from 'react';
import type { ShootingArea, ShootingAreaMode, ShootingAreaPoint } from '../lib/opportunities/types';
import type { LocationSearchResult } from '../lib/geocoding/types';
import NumberField from './NumberField';
import LocationSearch from './LocationSearch';

interface ShootingAreaControlsProps {
  area: ShootingArea;
  defaultPoint: ShootingAreaPoint;
  onModeChange: (_mode: ShootingAreaMode) => void;
  onAreaChange: (_area: ShootingArea) => void;
}

type PointField = 'name' | 'latitude' | 'longitude';

const MODE_INFO: Record<ShootingAreaMode, string> = {
  path: 'Every position along the path between Start and End is considered. The camera can be placed anywhere inside the valid zone that appears after a search.',
  points: 'Only the listed points are checked. Add a point by searching or by coordinates, then fine-tune it by dragging the marker on the map.'
};

function pointValue(point: ShootingAreaPoint, field: PointField) {
  if (field === 'latitude' || field === 'longitude') {
    return String(point[field]);
  }
  return point.name;
}

function applyPointField(point: ShootingAreaPoint, field: PointField, value: string): ShootingAreaPoint {
  if (field === 'latitude' || field === 'longitude') {
    return { ...point, [field]: Number(value) };
  }
  return { ...point, name: value };
}

export default function ShootingAreaControls({
  area,
  defaultPoint,
  onModeChange,
  onAreaChange
}: ShootingAreaControlsProps) {
  const idCounter = useRef(1);

  function nextPointId() {
    const id = `shooting-point-${Date.now().toString(36)}-${idCounter.current}`;
    idCounter.current += 1;
    return id;
  }

  function addPoint(point: ShootingAreaPoint) {
    if (area.type !== 'points') {
      return;
    }
    onAreaChange({ type: 'points', points: [...area.points, point] });
  }

  function updatePoint(pointId: string, field: PointField, value: string) {
    if (area.type !== 'points') {
      return;
    }
    onAreaChange({
      type: 'points',
      points: area.points.map((point) => (point.id === pointId ? applyPointField(point, field, value) : point))
    });
  }

  function removePoint(pointId: string) {
    if (area.type !== 'points') {
      return;
    }
    onAreaChange({ type: 'points', points: area.points.filter((point) => point.id !== pointId) });
  }

  function updatePathPoint(which: 'start' | 'end', field: PointField, value: string) {
    if (area.type !== 'path') {
      return;
    }
    const targetPoint = which === 'start' ? area.start : area.end;
    onAreaChange({
      type: 'path',
      start: which === 'start' ? applyPointField(targetPoint, field, value) : area.start,
      end: which === 'end' ? applyPointField(targetPoint, field, value) : area.end
    });
  }

  function handleSearchSelect(result: LocationSearchResult) {
    addPoint({
      id: nextPointId(),
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1" role="radiogroup" aria-label="Shooting area mode">
          <button
            type="button"
            role="radio"
            aria-checked={area.type === 'path'}
            onClick={() => onModeChange('path')}
            data-testid="area-mode-path"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              area.type === 'path' ? 'bg-violet-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Path
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={area.type === 'points'}
            onClick={() => onModeChange('points')}
            data-testid="area-mode-points"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              area.type === 'points' ? 'bg-violet-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Points
          </button>
        </div>
        <p className="max-w-sm text-xs text-slate-500">{MODE_INFO[area.type]}</p>
      </div>

      {area.type === 'path' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Start point</p>
            <div>
              <label htmlFor="shooting-path-start-name" className="text-sm text-slate-300">
                Name
              </label>
              <input
                id="shooting-path-start-name"
                type="text"
                value={pointValue(area.start, 'name')}
                onChange={(event) => updatePathPoint('start', 'name', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <NumberField
              id="shooting-path-start-latitude"
              label="Latitude"
              fieldValue={pointValue(area.start, 'latitude')}
              onChange={(value) => updatePathPoint('start', 'latitude', value)}
            />
            <NumberField
              id="shooting-path-start-longitude"
              label="Longitude"
              fieldValue={pointValue(area.start, 'longitude')}
              onChange={(value) => updatePathPoint('start', 'longitude', value)}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">End point</p>
            <div>
              <label htmlFor="shooting-path-end-name" className="text-sm text-slate-300">
                Name
              </label>
              <input
                id="shooting-path-end-name"
                type="text"
                value={pointValue(area.end, 'name')}
                onChange={(event) => updatePathPoint('end', 'name', event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <NumberField
              id="shooting-path-end-latitude"
              label="Latitude"
              fieldValue={pointValue(area.end, 'latitude')}
              onChange={(value) => updatePathPoint('end', 'latitude', value)}
            />
            <NumberField
              id="shooting-path-end-longitude"
              label="Longitude"
              fieldValue={pointValue(area.end, 'longitude')}
              onChange={(value) => updatePathPoint('end', 'longitude', value)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <LocationSearch
            idPrefix="shooting-area"
            placeholder="Search for a shooting point…"
            ariaLabel="Shooting point"
            onSelect={handleSearchSelect}
            emptyMessage="No places found. Try a more specific address or landmark."
            errorMessage="Unable to search for places right now."
          />

          {area.points.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-4 text-sm text-slate-500">
              No points yet. Add one below or with the search box above.
            </p>
          ) : (
            <div className="space-y-3">
              {area.points.map((point, index) => (
                <div key={point.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Point {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removePoint(point.id)}
                      aria-label={`Remove ${point.name || `point ${index + 1}`}`}
                      className="rounded-lg px-2 py-0.5 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-rose-300"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor={`shooting-point-${point.id}-name`} className="text-sm text-slate-300">
                        Name
                      </label>
                      <input
                        id={`shooting-point-${point.id}-name`}
                        type="text"
                        value={pointValue(point, 'name')}
                        onChange={(event) => updatePoint(point.id, 'name', event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberField
                        id={`shooting-point-${point.id}-latitude`}
                        label="Latitude"
                        fieldValue={pointValue(point, 'latitude')}
                        onChange={(value) => updatePoint(point.id, 'latitude', value)}
                      />
                      <NumberField
                        id={`shooting-point-${point.id}-longitude`}
                        label="Longitude"
                        fieldValue={pointValue(point, 'longitude')}
                        onChange={(value) => updatePoint(point.id, 'longitude', value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              addPoint({
                ...defaultPoint,
                id: nextPointId(),
                name: `Point ${area.points.length + 1}`
              })
            }
            data-testid="add-shooting-point"
            className="w-full rounded-2xl border border-dashed border-slate-600 bg-slate-900/40 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-violet-400 hover:text-violet-300"
          >
            + Add point
          </button>
        </div>
      )}
    </div>
  );
}
