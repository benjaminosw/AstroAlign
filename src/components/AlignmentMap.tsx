'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification
} from 'maplibre-gl';
import type { AstroObject } from '../types/astronomy';
import { getMapStyle } from '../lib/map/mapConfig';
import { directionEndpoint, directionLengthKm, toleranceSector } from '../lib/map/alignmentGeometry';

export interface AlignmentMapProps {
  observer: { latitude: number; longitude: number };
  target: { latitude: number; longitude: number };
  targetName?: string | null;
  object: AstroObject;
  objectAzimuth: number;
  targetBearing: number;
  targetDistanceKm: number;
  angularSeparation: number;
  toleranceDegrees: number;
  withinTolerance: boolean;
  azimuthLabel?: string;
  fitId?: number;
  className?: string;
}

const OBJECT_SYMBOL: Record<AstroObject, string> = {
  Sun: '☀',
  Moon: '🌙'
};

function buildLabeledMarkerElement(label: string, symbol: string): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:2px',
    'transform:translate(0,-100%)',
    'user-select:none',
    'pointer-events:none'
  ].join(';');
  const emoji = document.createElement('span');
  emoji.textContent = symbol;
  emoji.setAttribute('aria-hidden', 'true');
  emoji.style.cssText = 'font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.6))';
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  labelElement.className = 'alignment-marker-label';
  labelElement.style.cssText = [
    'font-size:11px',
    'font-weight:600',
    'color:#f8fafc',
    'background:rgb(15 23 42 / 0.85)',
    'padding:1px 6px',
    'border-radius:9999px',
    'white-space:nowrap',
    'max-width:150px',
    'overflow:hidden',
    'text-overflow:ellipsis'
  ].join(';');
  container.appendChild(emoji);
  container.appendChild(labelElement);
  return container;
}

function buildObserverPopup(latitude: number, longitude: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = 'Observer';
  container.appendChild(title);
  const latitudeLine = document.createElement('p');
  latitudeLine.textContent = `Latitude: ${latitude.toFixed(6)}`;
  const longitudeLine = document.createElement('p');
  longitudeLine.textContent = `Longitude: ${longitude.toFixed(6)}`;
  container.appendChild(latitudeLine);
  container.appendChild(longitudeLine);
  return container;
}

function buildTargetPopup(name: string | null, latitude: number, longitude: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = name ? `Target · ${name}` : 'Target';
  container.appendChild(title);
  const latitudeLine = document.createElement('p');
  latitudeLine.textContent = `Latitude: ${latitude.toFixed(6)}`;
  const longitudeLine = document.createElement('p');
  longitudeLine.textContent = `Longitude: ${longitude.toFixed(6)}`;
  container.appendChild(latitudeLine);
  container.appendChild(longitudeLine);
  return container;
}

function buildObjectPopup(label: string, azimuth: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = `${label} direction`;
  container.appendChild(title);
  const azimuthLine = document.createElement('p');
  azimuthLine.textContent = `Azimuth: ${azimuth.toFixed(2)}°`;
  container.appendChild(azimuthLine);
  return container;
}

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {}
  };
}

function polygonFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
    properties: {}
  };
}

export default function AlignmentMap({
  observer,
  target,
  targetName = null,
  object,
  objectAzimuth,
  targetBearing,
  targetDistanceKm,
  angularSeparation,
  toleranceDegrees,
  withinTolerance,
  azimuthLabel,
  fitId = 0,
  className = 'h-[420px] lg:h-[560px]'
}: AlignmentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const observerMarkerRef = useRef<MapLibreMarker | null>(null);
  const targetMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectMarkerElementRef = useRef<HTMLElement | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const lengthKm = directionLengthKm(targetDistanceKm);
  const objectEndpoint = directionEndpoint(observer, objectAzimuth, lengthKm);
  const sector = toleranceSector(observer, targetBearing, toleranceDegrees, lengthKm);

  const geometryRef = useRef({ observer, target, objectEndpoint, sector });
  geometryRef.current = { observer, target, objectEndpoint, sector };

  const objectLabel = azimuthLabel ?? `${object} azimuth`;

  function fitBounds() {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const geometry = geometryRef.current;
    const bounds = new maplibregl.LngLatBounds(
      [geometry.observer.longitude, geometry.observer.latitude],
      [geometry.observer.longitude, geometry.observer.latitude]
    );
    bounds.extend([geometry.target.longitude, geometry.target.latitude]);
    bounds.extend([geometry.objectEndpoint.longitude, geometry.objectEndpoint.latitude]);
    for (const [longitude, latitude] of geometry.sector) {
      bounds.extend([longitude, latitude]);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let map: MapLibreMap;
    try {
      const style: StyleSpecification = getMapStyle('osm').style;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [observer.longitude, observer.latitude],
        zoom: 13,
        attributionControl: { compact: true }
      });
    } catch {
      setMapFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('target-line', {
        type: 'geojson',
        data: lineFeature([
          [observer.longitude, observer.latitude],
          [target.longitude, target.latitude]
        ])
      });
      map.addSource('object-line', {
        type: 'geojson',
        data: lineFeature([
          [observer.longitude, observer.latitude],
          [objectEndpoint.longitude, objectEndpoint.latitude]
        ])
      });
      map.addSource('tolerance-sector', {
        type: 'geojson',
        data: polygonFeature(sector)
      });

      map.addLayer({
        id: 'target-line',
        type: 'line',
        source: 'target-line',
        paint: { 'line-color': '#38bdf8', 'line-width': 3 }
      });
      map.addLayer({
        id: 'object-line',
        type: 'line',
        source: 'object-line',
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-dasharray': [4, 3] }
      });
      map.addLayer({
        id: 'tolerance-sector-fill',
        type: 'fill',
        source: 'tolerance-sector',
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.08 }
      });

      const observerElement = buildLabeledMarkerElement('Observer', '📍');
      observerElement.setAttribute('aria-label', 'Observer');
      const observerMarker = new maplibregl.Marker({ element: observerElement })
        .setLngLat([observer.longitude, observer.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setDOMContent(buildObserverPopup(observer.latitude, observer.longitude))
        )
        .addTo(map);
      observerMarkerRef.current = observerMarker;

      const targetElement = buildLabeledMarkerElement(targetName ?? 'Target', '🎯');
      targetElement.setAttribute('aria-label', 'Target');
      const targetMarker = new maplibregl.Marker({ element: targetElement })
        .setLngLat([target.longitude, target.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setDOMContent(buildTargetPopup(targetName, target.latitude, target.longitude))
        )
        .addTo(map);
      targetMarkerRef.current = targetMarker;

      const objectElement = buildLabeledMarkerElement(object, OBJECT_SYMBOL[object]);
      objectElement.setAttribute('aria-label', `${object} direction`);
      const objectMarker = new maplibregl.Marker({ element: objectElement })
        .setLngLat([objectEndpoint.longitude, objectEndpoint.latitude])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(buildObjectPopup(objectLabel, objectAzimuth)))
        .addTo(map);
      objectMarkerRef.current = objectMarker;
      objectMarkerElementRef.current = objectElement;

      fitBounds();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      observerMarkerRef.current = null;
      targetMarkerRef.current = null;
      objectMarkerRef.current = null;
      objectMarkerElementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const targetLine = map.getSource('target-line') as GeoJSONSource | undefined;
    targetLine?.setData(
      lineFeature([
        [observer.longitude, observer.latitude],
        [target.longitude, target.latitude]
      ])
    );
    const objectLine = map.getSource('object-line') as GeoJSONSource | undefined;
    objectLine?.setData(
      lineFeature([
        [observer.longitude, observer.latitude],
        [objectEndpoint.longitude, objectEndpoint.latitude]
      ])
    );
    const sectorSource = map.getSource('tolerance-sector') as GeoJSONSource | undefined;
    sectorSource?.setData(polygonFeature(sector));

    observerMarkerRef.current?.setLngLat([observer.longitude, observer.latitude]);
    targetMarkerRef.current?.setLngLat([target.longitude, target.latitude]);
    objectMarkerRef.current?.setLngLat([objectEndpoint.longitude, objectEndpoint.latitude]);

    const observerPopup = observerMarkerRef.current?.getPopup?.();
    observerPopup?.setDOMContent(buildObserverPopup(observer.latitude, observer.longitude));
    const targetPopup = targetMarkerRef.current?.getPopup?.();
    targetPopup?.setDOMContent(buildTargetPopup(targetName, target.latitude, target.longitude));
    const objectPopup = objectMarkerRef.current?.getPopup?.();
    objectPopup?.setDOMContent(buildObjectPopup(objectLabel, objectAzimuth));

    const objectElement = objectMarkerElementRef.current;
    if (objectElement) {
      const spans = objectElement.querySelectorAll('span');
      if (spans[0]) {
        spans[0].textContent = OBJECT_SYMBOL[object];
      }
      if (spans[1]) {
        spans[1].textContent = object;
      }
    }
  }, [observer, target, targetName, object, objectAzimuth, targetBearing, targetDistanceKm, toleranceDegrees, objectEndpoint, objectLabel, sector]);

  useEffect(() => {
    fitBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitId]);

  if (mapFailed) {
    return (
      <div data-testid="alignment-map-unavailable" className={`${className} flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 text-center`}>
        <p className="text-sm font-semibold text-slate-200">Map unavailable</p>
        <p className="max-w-xs text-sm text-slate-400">The alignment calculations are still available below.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 ${className}`}>
      <div ref={containerRef} data-testid="alignment-map" className="h-full w-full" />

      <div
        data-testid="alignment-status"
        className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-xs shadow-lg"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Alignment</p>
        <dl className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-400">Target bearing</dt>
            <dd className="tabular-nums font-semibold text-sky-300">{targetBearing.toFixed(2)}°</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-400">{objectLabel}</dt>
            <dd className="tabular-nums font-semibold text-amber-300">{objectAzimuth.toFixed(2)}°</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1">
            <dt className="text-slate-400">Difference</dt>
            <dd className="tabular-nums font-semibold text-white">{angularSeparation.toFixed(2)}°</dd>
          </div>
        </dl>
        <p
          className={`mt-2 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold ${
            withinTolerance ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {withinTolerance ? `✓ Within ${toleranceDegrees}° tolerance` : `⚠ Outside ${toleranceDegrees}° tolerance`}
        </p>
      </div>

      <button
        type="button"
        onClick={fitBounds}
        data-testid="fit-alignment-button"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Fit alignment
      </button>
    </div>
  );
}
