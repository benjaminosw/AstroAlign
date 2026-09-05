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
import { directionEndpoint, REVERSE_RAY_LENGTH_KM } from '../lib/map/alignmentGeometry';
import { buildCameraElement, buildPinElement } from '../lib/map/markers';
import { greatCircleDistanceKm } from '../lib/geometry/distance';

const TARGET_PIN_COLOR = '#f59e0b';
const SHOOTING_LOCATION_COLOR = '#22c55e';

const OBJECT_SYMBOL: Record<AstroObject, string> = {
  Sun: '☀',
  Moon: '🌙'
};

export interface ReverseAlignmentOverlay {
  object: AstroObject;
  objectAzimuth: number;
  shootingBearing: number;
  observerDirectionFromTarget: number;
}

interface ReverseAlignmentMapProps {
  target: { latitude: number; longitude: number };
  targetName?: string | null;
  onTargetMove: (_latitude: number, _longitude: number) => void;
  overlay?: ReverseAlignmentOverlay | null;
  shootingLocation?: { latitude: number; longitude: number } | null;
  onShootingLocationMove?: (_latitude: number, _longitude: number) => void;
  flyToId?: number;
  className?: string;
}

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {}
  };
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

function buildShootingLocationPopup(
  latitude: number,
  longitude: number,
  distanceKm: number | null
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = 'Shooting location';
  container.appendChild(title);
  if (distanceKm !== null) {
    const distanceLine = document.createElement('p');
    distanceLine.textContent = `Distance from target: ${distanceKm.toFixed(2)} km`;
    container.appendChild(distanceLine);
  }
  const latitudeLine = document.createElement('p');
  latitudeLine.textContent = `Latitude: ${latitude.toFixed(6)}`;
  const longitudeLine = document.createElement('p');
  longitudeLine.textContent = `Longitude: ${longitude.toFixed(6)}`;
  container.appendChild(latitudeLine);
  container.appendChild(longitudeLine);
  return container;
}

const OBSERVER_RAY_PAINT = {
  'line-color': '#34d399',
  'line-width': 3
};

const OBJECT_LINE_PAINT = {
  'line-color': '#f59e0b',
  'line-width': 2.5,
  'line-dasharray': [4, 3]
};

export default function ReverseAlignmentMap({
  target,
  targetName = null,
  onTargetMove,
  overlay = null,
  shootingLocation = null,
  onShootingLocationMove = () => {},
  flyToId = 0,
  className = 'h-[380px] lg:h-[520px]'
}: ReverseAlignmentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const targetMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectMarkerRef = useRef<MapLibreMarker | null>(null);
  const objectElementRef = useRef<HTMLElement | null>(null);
  const shootingLocationMarkerRef = useRef<MapLibreMarker | null>(null);
  const [ready, setReady] = useState(false);

  const onTargetMoveRef = useRef(onTargetMove);
  onTargetMoveRef.current = onTargetMove;

  const onShootingLocationMoveRef = useRef(onShootingLocationMove);
  onShootingLocationMoveRef.current = onShootingLocationMove;

  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const shootingLocationRef = useRef(shootingLocation);
  shootingLocationRef.current = shootingLocation;

  const rayEndpoint = useMemo(
    () =>
      overlay
        ? directionEndpoint(target, overlay.observerDirectionFromTarget, REVERSE_RAY_LENGTH_KM)
        : null,
    [overlay, target]
  );

  const objectEndpoint = useMemo(
    () => (overlay ? directionEndpoint(target, overlay.objectAzimuth, REVERSE_RAY_LENGTH_KM) : null),
    [overlay, target]
  );

  const geometryRef = useRef({ target, rayEndpoint, objectEndpoint });
  geometryRef.current = { target, rayEndpoint, objectEndpoint };

  function fitBoundsToResult() {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const geometry = geometryRef.current;
    const bounds = new maplibregl.LngLatBounds(
      [geometry.target.longitude, geometry.target.latitude],
      [geometry.target.longitude, geometry.target.latitude]
    );
    for (const endpoint of [geometry.rayEndpoint, geometry.objectEndpoint]) {
      if (endpoint) {
        bounds.extend([endpoint.longitude, endpoint.latitude]);
      }
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
  }

  function fitBoundsToTarget() {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const { target: currentTarget } = geometryRef.current;
    const bounds = new maplibregl.LngLatBounds(
      [currentTarget.longitude, currentTarget.latitude],
      [currentTarget.longitude, currentTarget.latitude]
    );
    map.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 600 });
  }

  function setLineData(map: MapLibreMap, sourceId: string, endpoint: { latitude: number; longitude: number }) {
    const data = lineFeature([
      [target.longitude, target.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data });
    }
    (map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data);
  }

  function ensureLayer(map: MapLibreMap, layerId: string, sourceId: string, paint: typeof OBSERVER_RAY_PAINT | typeof OBJECT_LINE_PAINT) {
    if (!map.getLayer(layerId)) {
      map.addLayer({ id: layerId, type: 'line', source: sourceId, paint });
    }
  }

  function removeShootingLocationMarker() {
    shootingLocationMarkerRef.current?.remove();
    shootingLocationMarkerRef.current = null;
  }

  function syncShootingLocationMarker(map: MapLibreMap) {
    const location = shootingLocationRef.current;
    const existing = shootingLocationMarkerRef.current;
    if (!location) {
      removeShootingLocationMarker();
      return;
    }
    const distanceKm = greatCircleDistanceKm(
      target.latitude,
      target.longitude,
      location.latitude,
      location.longitude
    );
    const popupContent = () => buildShootingLocationPopup(location.latitude, location.longitude, distanceKm);
    if (!existing) {
      const element = buildCameraElement(SHOOTING_LOCATION_COLOR, 1);
      element.setAttribute('aria-label', 'Shooting location');
      const marker = new maplibregl.Marker({ element, draggable: true, anchor: 'bottom' })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 14 }).setDOMContent(popupContent()))
        .addTo(map);
      marker.on('drag', () => {
        const position = marker.getLngLat();
        onShootingLocationMoveRef.current(position.lat, position.lng);
      });
      shootingLocationMarkerRef.current = marker;
    } else {
      const position = existing.getLngLat();
      if (
        Math.abs(position.lat - location.latitude) > 1e-9 ||
        Math.abs(position.lng - location.longitude) > 1e-9
      ) {
        existing.setLngLat([location.longitude, location.latitude]);
      }
      existing.getPopup?.()?.setDOMContent(popupContent());
    }
  }

  function removeOverlay(map: MapLibreMap) {
    for (const layerId of ['reverse-ray-line', 'reverse-object-line']) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }
    for (const sourceId of ['reverse-ray-line', 'reverse-object-line']) {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
    objectMarkerRef.current?.remove();
    objectMarkerRef.current = null;
    objectElementRef.current = null;
    removeShootingLocationMarker();
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
        center: [target.longitude, target.latitude],
        zoom: 13,
        attributionControl: { compact: true }
      });
    } catch {
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      const currentOverlay = overlayRef.current;
      if (currentOverlay && rayEndpoint && objectEndpoint) {
        setLineData(map, 'reverse-ray-line', rayEndpoint);
        ensureLayer(map, 'reverse-ray-line', 'reverse-ray-line', OBSERVER_RAY_PAINT);
        setLineData(map, 'reverse-object-line', objectEndpoint);
        ensureLayer(map, 'reverse-object-line', 'reverse-object-line', OBJECT_LINE_PAINT);
      }

      const targetBuilt = buildPinElement(TARGET_PIN_COLOR);
      targetBuilt.setAttribute('aria-label', 'Target');
      const targetMarker = new maplibregl.Marker({ element: targetBuilt, draggable: true, anchor: 'bottom' })
        .setLngLat([target.longitude, target.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 28 }).setDOMContent(
            buildTargetPopup(targetName, target.latitude, target.longitude)
          )
        )
        .addTo(map);
      targetMarker.on('dragend', () => {
        const position = targetMarker.getLngLat();
        onTargetMoveRef.current(position.lat, position.lng);
      });
      targetMarkerRef.current = targetMarker;

      if (currentOverlay && objectEndpoint) {
        const objectElement = buildObjectMarkerElement(currentOverlay.object);
        objectElement.setAttribute('aria-label', `${currentOverlay.object} direction`);
        const objectMarker = new maplibregl.Marker({ element: objectElement, anchor: 'bottom' })
          .setLngLat([objectEndpoint.longitude, objectEndpoint.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setDOMContent(
              buildObjectPopup(`${currentOverlay.object} azimuth`, currentOverlay.objectAzimuth)
            )
          )
          .addTo(map);
        objectMarkerRef.current = objectMarker;
        objectElementRef.current = objectElement;
      }

      syncShootingLocationMarker(map);
      fitBoundsToTarget();
      setReady(true);
    });

    map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      targetMarkerRef.current?.setLngLat([event.lngLat.lng, event.lngLat.lat]);
      onTargetMoveRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      targetMarkerRef.current = null;
      objectMarkerRef.current = null;
      objectElementRef.current = null;
      shootingLocationMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
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

    if (!overlay || !rayEndpoint || !objectEndpoint) {
      removeOverlay(map);
      return;
    }

    setLineData(map, 'reverse-ray-line', rayEndpoint);
    ensureLayer(map, 'reverse-ray-line', 'reverse-ray-line', OBSERVER_RAY_PAINT);
    setLineData(map, 'reverse-object-line', objectEndpoint);
    ensureLayer(map, 'reverse-object-line', 'reverse-object-line', OBJECT_LINE_PAINT);

    if (!objectMarkerRef.current) {
      const objectElement = buildObjectMarkerElement(overlay.object);
      objectElement.setAttribute('aria-label', `${overlay.object} direction`);
      const objectMarker = new maplibregl.Marker({ element: objectElement, anchor: 'bottom' })
        .setLngLat([objectEndpoint.longitude, objectEndpoint.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setDOMContent(
            buildObjectPopup(`${overlay.object} azimuth`, overlay.objectAzimuth)
          )
        )
        .addTo(map);
      objectMarkerRef.current = objectMarker;
      objectElementRef.current = objectElement;
    } else {
      const objectMarker = objectMarkerRef.current;
      const position = objectMarker.getLngLat();
      if (
        Math.abs(position.lat - objectEndpoint.latitude) > 1e-9 ||
        Math.abs(position.lng - objectEndpoint.longitude) > 1e-9
      ) {
        objectMarker.setLngLat([objectEndpoint.longitude, objectEndpoint.latitude]);
      }
      const objectPopup = objectMarker.getPopup?.();
      objectPopup?.setDOMContent(buildObjectPopup(`${overlay.object} azimuth`, overlay.objectAzimuth));
      const objectElement = objectElementRef.current;
      if (objectElement) {
        const emojiSpan = objectElement.querySelector('span');
        if (emojiSpan) {
          emojiSpan.textContent = OBJECT_SYMBOL[overlay.object];
        }
      }
    }

    syncShootingLocationMarker(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, targetName, overlay, rayEndpoint, objectEndpoint, shootingLocation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || flyToId === 0) {
      return;
    }
    fitBoundsToTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToId]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 ${className}`}>
      <div ref={containerRef} data-testid="reverse-alignment-map" className="h-full w-full" />

      {overlay && (
        <div
          data-testid="reverse-alignment-status"
          className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-3 text-xs shadow-lg"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Reverse alignment</p>
          <dl className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">{overlay.object} azimuth</dt>
              <dd className="tabular-nums font-semibold text-amber-300">{overlay.objectAzimuth.toFixed(2)}°</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Observer → Target</dt>
              <dd className="tabular-nums font-semibold text-sky-300">{overlay.shootingBearing.toFixed(2)}°</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Target → Possible observer</dt>
              <dd className="tabular-nums font-semibold text-emerald-300">
                {overlay.observerDirectionFromTarget.toFixed(2)}°
              </dd>
            </div>
          </dl>
        </div>
      )}

      <button
        type="button"
        onClick={() => (overlay ? fitBoundsToResult() : fitBoundsToTarget())}
        data-testid="recentre-button"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Recentre
      </button>
    </div>
  );
}
