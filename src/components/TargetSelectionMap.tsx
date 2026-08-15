'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from 'maplibre-gl';
import { getMapStyle } from '../lib/map/mapConfig';

interface TargetSelectionMapProps {
  latitude: number;
  longitude: number;
  landmarkName?: string | null;
  onMove: (_latitude: number, _longitude: number) => void;
  flyToId?: number;
}

function buildMarkerElement(): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('aria-label', 'Target');
  element.setAttribute('role', 'button');
  element.textContent = '🎯';
  element.style.cssText = [
    'font-size: 30px',
    'line-height: 1',
    'cursor: grab',
    'user-select: none',
    'transform: translate(0, -50%)',
    'filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.6))'
  ].join(';');
  return element;
}

function buildPopupElement(name: string | null, latitude: number, longitude: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  if (name) {
    const title = document.createElement('p');
    title.textContent = name;
    container.appendChild(title);
  }
  const latitudeLine = document.createElement('p');
  latitudeLine.textContent = `Latitude: ${latitude.toFixed(6)}`;
  const longitudeLine = document.createElement('p');
  longitudeLine.textContent = `Longitude: ${longitude.toFixed(6)}`;
  container.appendChild(latitudeLine);
  container.appendChild(longitudeLine);
  return container;
}

export default function TargetSelectionMap({
  latitude,
  longitude,
  landmarkName = null,
  onMove,
  flyToId = 0
}: TargetSelectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const onMoveRef = useRef(onMove);

  onMoveRef.current = onMove;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const style: StyleSpecification = getMapStyle('osm').style;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [longitude, latitude],
      zoom: 14,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      const marker = new maplibregl.Marker({ element: buildMarkerElement(), draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(map);
      marker.setPopup(
        new maplibregl.Popup({ offset: 20 }).setDOMContent(buildPopupElement(landmarkName, latitude, longitude))
      );
      marker.on('dragend', () => {
        const position = marker.getLngLat();
        onMoveRef.current(position.lat, position.lng);
      });
      markerRef.current = marker;
    });

    map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      markerRef.current?.setLngLat([event.lngLat.lng, event.lngLat.lat]);
      onMoveRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }
    const current = marker.getLngLat();
    if (Math.abs(current.lat - latitude) < 1e-9 && Math.abs(current.lng - longitude) < 1e-9) {
      return;
    }
    marker.setLngLat([longitude, latitude]);
    const popup = marker.getPopup?.();
    if (popup) {
      popup.setDOMContent(buildPopupElement(landmarkName, latitude, longitude));
    }
  }, [latitude, longitude, landmarkName]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToId]);

  return <div ref={containerRef} data-testid="target-selection-map" className="h-[300px] w-full rounded-2xl" />;
}
