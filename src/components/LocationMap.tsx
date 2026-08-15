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
import { getMapStyle } from '../lib/map/mapConfig';

type LocationId = 'observer' | 'target';

interface LocationMapProps {
  observer: { latitude: number; longitude: number };
  target: { latitude: number; longitude: number };
  observerName?: string | null;
  targetName?: string | null;
  activeLocation: LocationId;
  onObserverMove: (_latitude: number, _longitude: number) => void;
  onTargetMove: (_latitude: number, _longitude: number) => void;
  onActivate: (_location: LocationId) => void;
  fitId?: number;
  className?: string;
}

const LOCATION_EMOJI: Record<LocationId, string> = {
  observer: '📍',
  target: '🎯'
};

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {}
  };
}

function buildMarkerElement(emoji: string, label: string): { element: HTMLElement; labelRef: HTMLSpanElement } {
  const element = document.createElement('div');
  element.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:2px',
    'transform:translate(0,-100%)',
    'cursor:grab',
    'user-select:none'
  ].join(';');
  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = emoji;
  emojiSpan.setAttribute('aria-hidden', 'true');
  emojiSpan.style.cssText = 'font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.6))';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  labelSpan.style.cssText = [
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
  element.appendChild(emojiSpan);
  element.appendChild(labelSpan);
  return { element, labelRef: labelSpan };
}

function setMarkerActive(element: HTMLElement | null, isActive: boolean) {
  if (!element) {
    return;
  }
  element.setAttribute('data-marker-active', String(isActive));
  const emojiSpan = element.querySelector('span');
  if (emojiSpan) {
    emojiSpan.style.fontSize = isActive ? '34px' : '24px';
  }
  element.style.filter = isActive ? 'drop-shadow(0 0 6px rgb(56 189 248 / 0.9))' : 'none';
}

export default function LocationMap({
  observer,
  target,
  observerName = null,
  targetName = null,
  activeLocation,
  onObserverMove,
  onTargetMove,
  onActivate,
  fitId = 0,
  className = 'h-[340px]'
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const observerMarkerRef = useRef<MapLibreMarker | null>(null);
  const targetMarkerRef = useRef<MapLibreMarker | null>(null);
  const observerElementRef = useRef<HTMLElement | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const activeLocationRef = useRef(activeLocation);
  activeLocationRef.current = activeLocation;

  const handlersRef = useRef({ onObserverMove, onTargetMove, onActivate });
  handlersRef.current = { onObserverMove, onTargetMove, onActivate };

  function fitBounds() {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const bounds = new maplibregl.LngLatBounds(
      [observer.longitude, observer.latitude],
      [observer.longitude, observer.latitude]
    );
    bounds.extend([target.longitude, target.latitude]);
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

      const observerBuilt = buildMarkerElement(LOCATION_EMOJI.observer, observerName ?? 'Observer');
      observerBuilt.element.setAttribute('aria-label', 'Observer');
      const observerMarker = new maplibregl.Marker({ element: observerBuilt.element, draggable: true })
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
      observerElementRef.current = observerBuilt.element;

      const targetBuilt = buildMarkerElement(LOCATION_EMOJI.target, targetName ?? 'Target');
      targetBuilt.element.setAttribute('aria-label', 'Target');
      const targetMarker = new maplibregl.Marker({ element: targetBuilt.element, draggable: true })
        .setLngLat([target.longitude, target.latitude])
        .addTo(map);
      targetMarker.on('dragstart', () => {
        handlersRef.current.onActivate('target');
      });
      targetMarker.on('drag', () => {
        const position = targetMarker.getLngLat();
        handlersRef.current.onTargetMove(position.lat, position.lng);
      });
      targetMarkerRef.current = targetMarker;
      targetElementRef.current = targetBuilt.element;

      setMarkerActive(observerBuilt.element, activeLocationRef.current === 'observer');
      setMarkerActive(targetBuilt.element, activeLocationRef.current === 'target');

      fitBounds();
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
      observerElementRef.current = null;
      targetElementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMarkerActive(observerElementRef.current, activeLocation === 'observer');
    setMarkerActive(targetElementRef.current, activeLocation === 'target');
  }, [activeLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
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

    const observerLabel = observerElementRef.current?.querySelector('span:last-child');
    if (observerLabel) {
      observerLabel.textContent = observerName ?? 'Observer';
    }
    const targetLabel = targetElementRef.current?.querySelector('span:last-child');
    if (targetLabel) {
      targetLabel.textContent = targetName ?? 'Target';
    }
  }, [observer, target, observerName, targetName]);

  useEffect(() => {
    fitBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitId]);

  if (mapFailed) {
    return (
      <div
        data-testid="location-map-unavailable"
        className={`${className} flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 text-center`}
      >
        <p className="text-sm font-semibold text-slate-200">Map unavailable</p>
        <p className="max-w-xs text-sm text-slate-400">You can still enter coordinates below.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 ${className}`}>
      <div ref={containerRef} data-testid="location-map" className="h-full w-full" />

      <button
        type="button"
        onClick={fitBounds}
        data-testid="fit-locations-button"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Fit Observer + Target
      </button>
    </div>
  );
}
