'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { greatCircleDistanceKm } from '../lib/geometry/distance';

type LocationId = 'observer' | 'target';

export interface AlignmentOverlay {
  object: AstroObject;
  objectAzimuth: number;
  targetBearing: number;
  targetDistanceKm: number;
  angularSeparation: number;
  toleranceDegrees: number;
  withinTolerance: boolean;
  azimuthLabel?: string;
}

interface SunPosition {
  object: AstroObject;
  azimuth: number;
}

interface WorkspaceMapProps {
  observer: { latitude: number; longitude: number };
  target: { latitude: number; longitude: number };
  targetName?: string | null;
  activeLocation: LocationId;
  onObserverMove: (_latitude: number, _longitude: number) => void;
  onTargetMove: (_latitude: number, _longitude: number) => void;
  onActivate: (_location: LocationId) => void;
  fitId?: number;
  fitTarget?: 'both' | 'observer' | 'target';
  alignment?: AlignmentOverlay | null;
  sun?: SunPosition | null;
  className?: string;
}

const PIN_COLOR: Record<LocationId, string> = {
  observer: '#38bdf8',
  target: '#f59e0b'
};

const OBJECT_SYMBOL: Record<AstroObject, string> = {
  Sun: '☀',
  Moon: '🌙'
};

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

function buildPinElement(color: string): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))',
    'transition:filter 140ms ease'
  ].join(';');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 40');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '36');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'display:block',
    'transition:transform 140ms ease',
    'transform-origin:50% 100%'
  ].join(';');
  svg.innerHTML = [
    `<path d="M16 1.5C8.8 1.5 3 7.3 3 14.5 3 23 16 38.5 16 38.5 16 38.5 29 23 29 14.5 29 7.3 23.2 1.5 16 1.5Z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.5"/>`,
    '<circle cx="16" cy="14" r="5.5" fill="white"/>',
    `<circle cx="16" cy="14" r="3" fill="${color}"/>`
  ].join('');
  element.appendChild(svg);
  return element;
}

function buildCameraElement(color: string): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))',
    'transition:filter 140ms ease'
  ].join(';');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 36');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '32');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'display:block',
    'transition:transform 140ms ease',
    'transform-origin:50% 100%'
  ].join(';');
  svg.innerHTML = [
    `<path d="M12 7 L13 4 L19 4 L20 7 Z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.2"/>`,
    `<path d="M7 7 h18 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-18 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z" fill="${color}" stroke="rgba(15,23,42,0.85)" stroke-width="1.5"/>`,
    '<circle cx="16" cy="12.5" r="4.5" fill="white"/>',
    `<circle cx="16" cy="12.5" r="2.75" fill="${color}"/>`,
    `<path d="M13 21 L7 35 M19 21 L25 35 M16 21 L16 35" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`,
    `<circle cx="7" cy="35" r="1.5" fill="${color}"/>`,
    `<circle cx="25" cy="35" r="1.5" fill="${color}"/>`,
    `<circle cx="16" cy="35" r="1.5" fill="${color}"/>`
  ].join('');
  element.appendChild(svg);
  return element;
}

function setMarkerActive(element: HTMLElement | null, isActive: boolean) {
  if (!element) {
    return;
  }
  element.setAttribute('data-marker-active', String(isActive));
  const svg = element.querySelector('svg');
  if (svg) {
    svg.style.transform = isActive ? 'scale(1.25)' : 'scale(1)';
  }
  element.style.filter = isActive
    ? 'drop-shadow(0 0 10px rgb(56 189 248 / 0.8)) drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))'
    : 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))';
}

function buildObjectMarkerElement(object: AstroObject): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'user-select:none',
    'pointer-events:none'
  ].join(';');
  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = OBJECT_SYMBOL[object];
  emojiSpan.setAttribute('aria-hidden', 'true');
  emojiSpan.style.cssText = 'font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.6))';
  element.appendChild(emojiSpan);
  return element;
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

const OBJECT_LINE_PAINT = {
  'line-color': '#f59e0b',
  'line-width': 2.5,
  'line-dasharray': [4, 3]
};

export default function WorkspaceMap({
  observer,
  target,
  targetName = null,
  activeLocation,
  onObserverMove,
  onTargetMove,
  onActivate,
  fitId = 0,
  fitTarget = 'both',
  alignment = null,
  sun = null,
  className = 'h-[480px] lg:h-[620px]'
}: WorkspaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const observerMarkerRef = useRef<MapLibreMarker | null>(null);
  const targetMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectMarkerRef = useRef<MapLibreMarker | null>(null);
  const observerElementRef = useRef<HTMLElement | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const objectMarkerElementRef = useRef<HTMLElement | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const activeLocationRef = useRef(activeLocation);
  activeLocationRef.current = activeLocation;

  const handlersRef = useRef({ onObserverMove, onTargetMove, onActivate });
  handlersRef.current = { onObserverMove, onTargetMove, onActivate };

  const alignmentRef = useRef(alignment);
  alignmentRef.current = alignment;

  const sunRef = useRef(sun);
  sunRef.current = sun;

  const lengthKm = alignment ? directionLengthKm(alignment.targetDistanceKm) : 1;
  const sector = useMemo(
    () =>
      alignment ? toleranceSector(observer, alignment.targetBearing, alignment.toleranceDegrees, lengthKm) : [],
    [alignment, observer, lengthKm]
  );

  const sunLengthKm = useMemo(() => {
    const distance = greatCircleDistanceKm(observer.latitude, observer.longitude, target.latitude, target.longitude);
    return directionLengthKm(distance);
  }, [observer, target]);

  const sunEndpoint = useMemo(
    () => (sun ? directionEndpoint(observer, sun.azimuth, sunLengthKm) : observer),
    [sun, observer, sunLengthKm]
  );

  const geometryRef = useRef({ observer, target, sector, sunEndpoint });
  geometryRef.current = { observer, target, sector, sunEndpoint };

  function fitBoundsTo(kind: 'both' | 'observer' | 'target') {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const geometry = geometryRef.current;
    if (kind === 'observer') {
      const bounds = new maplibregl.LngLatBounds(
        [geometry.observer.longitude, geometry.observer.latitude],
        [geometry.observer.longitude, geometry.observer.latitude]
      );
      map.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 600 });
      return;
    }
    if (kind === 'target') {
      const bounds = new maplibregl.LngLatBounds(
        [geometry.target.longitude, geometry.target.latitude],
        [geometry.target.longitude, geometry.target.latitude]
      );
      map.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 600 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds(
      [geometry.observer.longitude, geometry.observer.latitude],
      [geometry.observer.longitude, geometry.observer.latitude]
    );
    bounds.extend([geometry.target.longitude, geometry.target.latitude]);
    for (const [longitude, latitude] of geometry.sector) {
      bounds.extend([longitude, latitude]);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
  }

  function ensureObjectLine(map: MapLibreMap, endpoint: { latitude: number; longitude: number }) {
    const lineData = lineFeature([
      [observer.longitude, observer.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);
    if (!map.getSource('object-line')) {
      map.addSource('object-line', { type: 'geojson', data: lineData });
    }
    if (!map.getLayer('object-line')) {
      map.addLayer({ id: 'object-line', type: 'line', source: 'object-line', paint: OBJECT_LINE_PAINT });
    }
    (map.getSource('object-line') as GeoJSONSource | undefined)?.setData(lineData);
  }

  function removeObjectLine(map: MapLibreMap) {
    if (map.getLayer('object-line')) {
      map.removeLayer('object-line');
    }
    if (map.getSource('object-line')) {
      map.removeSource('object-line');
    }
  }

  function ensureSector(map: MapLibreMap) {
    if (!map.getSource('tolerance-sector')) {
      map.addSource('tolerance-sector', { type: 'geojson', data: polygonFeature(sector) });
    }
    if (!map.getLayer('tolerance-sector-fill')) {
      map.addLayer({
        id: 'tolerance-sector-fill',
        type: 'fill',
        source: 'tolerance-sector',
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.08 }
      });
    }
    (map.getSource('tolerance-sector') as GeoJSONSource | undefined)?.setData(polygonFeature(sector));
  }

  function removeSector(map: MapLibreMap) {
    if (map.getLayer('tolerance-sector-fill')) {
      map.removeLayer('tolerance-sector-fill');
    }
    if (map.getSource('tolerance-sector')) {
      map.removeSource('tolerance-sector');
    }
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
      map.addSource('observer-target-line', {
        type: 'geojson',
        data: lineFeature([
          [observer.longitude, observer.latitude],
          [target.longitude, target.latitude]
        ])
      });
      map.addLayer({
        id: 'observer-target-line',
        type: 'line',
        source: 'observer-target-line',
        paint: { 'line-color': '#38bdf8', 'line-width': 3 }
      });

      if (sunRef.current) {
        const currentSun = sunRef.current;
        const currentSunEndpoint = sunRef.current
          ? directionEndpoint(observer, currentSun.azimuth, sunLengthKm)
          : observer;
        ensureObjectLine(map, currentSunEndpoint);
        const objectElement = buildObjectMarkerElement(currentSun.object);
        objectElement.setAttribute('aria-label', `${currentSun.object} direction`);
        const objectMarker = new maplibregl.Marker({ element: objectElement, anchor: 'bottom' })
          .setLngLat([currentSunEndpoint.longitude, currentSunEndpoint.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setDOMContent(
              buildObjectPopup(`${currentSun.object} azimuth`, currentSun.azimuth)
            )
          )
          .addTo(map);
        objectMarkerRef.current = objectMarker;
        objectMarkerElementRef.current = objectElement;
      }

      const observerBuilt = buildCameraElement(PIN_COLOR.observer);
      observerBuilt.setAttribute('aria-label', 'Observer');
      const observerMarker = new maplibregl.Marker({ element: observerBuilt, draggable: true, anchor: 'bottom' })
        .setLngLat([observer.longitude, observer.latitude])
        .addTo(map);
      observerMarker.on('dragstart', () => {
        handlersRef.current.onActivate('observer');
      });
      observerMarker.on('drag', () => {
        const position = observerMarker.getLngLat();
        handlersRef.current.onObserverMove(position.lat, position.lng);
      });
      observerMarkerRef.current = observerMarker;
      observerElementRef.current = observerBuilt;

      const targetBuilt = buildPinElement(PIN_COLOR.target);
      targetBuilt.setAttribute('aria-label', 'Target');
      const targetMarker = new maplibregl.Marker({ element: targetBuilt, draggable: true, anchor: 'bottom' })
        .setLngLat([target.longitude, target.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 28 }).setDOMContent(
            buildTargetPopup(targetName, target.latitude, target.longitude)
          )
        )
        .addTo(map);
      targetMarker.on('dragstart', () => {
        handlersRef.current.onActivate('target');
      });
      targetMarker.on('drag', () => {
        const position = targetMarker.getLngLat();
        handlersRef.current.onTargetMove(position.lat, position.lng);
      });
      targetMarkerRef.current = targetMarker;
      targetElementRef.current = targetBuilt;

      setMarkerActive(observerBuilt, activeLocationRef.current === 'observer');
      setMarkerActive(targetBuilt, activeLocationRef.current === 'target');

      fitBoundsTo('both');
      setReady(true);
    });

    map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      const { lat, lng } = event.lngLat;
      if (activeLocationRef.current === 'observer') {
        observerMarkerRef.current?.setLngLat([lng, lat]);
        handlersRef.current.onObserverMove(lat, lng);
      } else {
        targetMarkerRef.current?.setLngLat([lng, lat]);
        handlersRef.current.onTargetMove(lat, lng);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      observerMarkerRef.current = null;
      targetMarkerRef.current = null;
      objectMarkerRef.current = null;
      observerElementRef.current = null;
      targetElementRef.current = null;
      objectMarkerElementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMarkerActive(observerElementRef.current, activeLocation === 'observer');
    setMarkerActive(targetElementRef.current, activeLocation === 'target');
  }, [activeLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const line = map.getSource('observer-target-line') as GeoJSONSource | undefined;
    line?.setData(
      lineFeature([
        [observer.longitude, observer.latitude],
        [target.longitude, target.latitude]
      ])
    );

    const observerMarker = observerMarkerRef.current;
    if (observerMarker) {
      const position = observerMarker.getLngLat();
      if (Math.abs(position.lat - observer.latitude) > 1e-9 || Math.abs(position.lng - observer.longitude) > 1e-9) {
        observerMarker.setLngLat([observer.longitude, observer.latitude]);
      }
    }
    const targetMarker = targetMarkerRef.current;
    if (targetMarker) {
      const position = targetMarker.getLngLat();
      if (Math.abs(position.lat - target.latitude) > 1e-9 || Math.abs(position.lng - target.longitude) > 1e-9) {
        targetMarker.setLngLat([target.longitude, target.latitude]);
      }
    }

    const targetPopup = targetMarker?.getPopup?.();
    targetPopup?.setDOMContent(buildTargetPopup(targetName, target.latitude, target.longitude));

    if (alignment) {
      ensureSector(map);
    } else {
      removeSector(map);
    }

    if (sun) {
      ensureObjectLine(map, sunEndpoint);
      const currentSun = sunRef.current;
      if (!objectMarkerRef.current && currentSun) {
        const objectElement = buildObjectMarkerElement(currentSun.object);
        objectElement.setAttribute('aria-label', `${currentSun.object} direction`);
        const objectMarker = new maplibregl.Marker({ element: objectElement, anchor: 'bottom' })
          .setLngLat([sunEndpoint.longitude, sunEndpoint.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setDOMContent(
              buildObjectPopup(`${currentSun.object} azimuth`, currentSun.azimuth)
            )
          )
          .addTo(map);
        objectMarkerRef.current = objectMarker;
        objectMarkerElementRef.current = objectElement;
      } else {
        const objectMarker = objectMarkerRef.current;
        if (objectMarker) {
          const position = objectMarker.getLngLat();
          if (
            Math.abs(position.lat - sunEndpoint.latitude) > 1e-9 ||
            Math.abs(position.lng - sunEndpoint.longitude) > 1e-9
          ) {
            objectMarker.setLngLat([sunEndpoint.longitude, sunEndpoint.latitude]);
          }
        }
        const objectPopup = objectMarker?.getPopup?.();
        objectPopup?.setDOMContent(buildObjectPopup(`${sun.object} azimuth`, sun.azimuth));
        const objectElement = objectMarkerElementRef.current;
        if (objectElement) {
          const emojiSpan = objectElement.querySelector('span');
          if (emojiSpan) {
            emojiSpan.textContent = OBJECT_SYMBOL[sun.object];
          }
        }
      }
    } else {
      removeObjectLine(map);
      objectMarkerRef.current?.remove();
      objectMarkerRef.current = null;
      objectMarkerElementRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer, target, targetName, alignment, sun, sunEndpoint, sector, ready]);

  useEffect(() => {
    fitBoundsTo(fitTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitId]);

  const objectLabel = alignment ? (alignment.azimuthLabel ?? `${alignment.object} azimuth`) : '';

  if (mapFailed) {
    return (
      <div
        data-testid="workspace-map-unavailable"
        className={`${className} flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 text-center`}
      >
        <p className="text-sm font-semibold text-slate-200">Map unavailable</p>
        <p className="max-w-xs text-sm text-slate-400">You can still enter coordinates below.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 ${className}`}>
      <div ref={containerRef} data-testid="workspace-map" className="h-full w-full" />

      {alignment && (
        <div
          data-testid="alignment-status"
          className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-xs shadow-lg"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Alignment</p>
          <dl className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Target bearing</dt>
              <dd className="tabular-nums font-semibold text-sky-300">{alignment.targetBearing.toFixed(2)}°</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">{objectLabel}</dt>
              <dd className="tabular-nums font-semibold text-amber-300">{alignment.objectAzimuth.toFixed(2)}°</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1">
              <dt className="text-slate-400">Difference</dt>
              <dd className="tabular-nums font-semibold text-white">{alignment.angularSeparation.toFixed(2)}°</dd>
            </div>
          </dl>
          <p
            className={`mt-2 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold ${
              alignment.withinTolerance ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            {alignment.withinTolerance
              ? `✓ Within ${alignment.toleranceDegrees}° tolerance`
              : `⚠ Outside ${alignment.toleranceDegrees}° tolerance`}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => fitBoundsTo('both')}
        data-testid="recentre-button"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Recentre
      </button>
    </div>
  );
}
