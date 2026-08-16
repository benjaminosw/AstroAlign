'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from 'maplibre-gl';
import { getMapStyle } from '../lib/map/mapConfig';
import { buildAreaMarkerElement, buildCameraElement, buildPinElement } from '../lib/map/markers';
import type { SavedShootingGeometry } from '../lib/saved/types';
import { savedPointCount } from '../lib/saved/types';
import { pathPointAtFraction, pathTotalLengthKm } from '../lib/opportunities/pathGeometry';
import { initialBearing } from '../lib/geometry/bearing';

interface SavedMapPoint {
  id: string;
  kind: 'target' | 'start' | 'end' | 'point';
  label: string;
  latitude: number;
  longitude: number;
}

export interface SavedLocationMapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface SavedLocationMapProps {
  target?: { latitude: number; longitude: number; name?: string | null } | null;
  shootingLocation?: { geometry: SavedShootingGeometry; name?: string | null } | null;
  editable?: boolean;
  onMarkerMove?: (_markerId: string, _latitude: number, _longitude: number) => void;
  fitId?: number;
  initialViewport?: SavedLocationMapViewport | null;
  onViewportChange?: (_viewport: SavedLocationMapViewport) => void;
}

const TARGET_COLOR = '#f59e0b';
const START_COLOR = '#22c55e';
const END_COLOR = '#ef4444';
const POINT_COLOR = '#8b5cf6';
const PATH_COLOR = '#10b981';

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {}
  };
}

function buildPointPopup(title: string, latitude: number, longitude: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'text-xs';
  const titleNode = document.createElement('p');
  titleNode.className = 'font-semibold';
  titleNode.textContent = title;
  container.appendChild(titleNode);
  const latitudeLine = document.createElement('p');
  latitudeLine.textContent = `Latitude: ${latitude.toFixed(6)}`;
  const longitudeLine = document.createElement('p');
  longitudeLine.textContent = `Longitude: ${longitude.toFixed(6)}`;
  container.appendChild(latitudeLine);
  container.appendChild(longitudeLine);
  return container;
}

function collectMapPoints(
  target: SavedLocationMapProps['target'],
  shootingLocation: SavedLocationMapProps['shootingLocation']
): SavedMapPoint[] {
  const points: SavedMapPoint[] = [];
  if (target) {
    points.push({
      id: 'target',
      kind: 'target',
      label: target.name || 'Target',
      latitude: target.latitude,
      longitude: target.longitude
    });
  }
  if (!shootingLocation) {
    return points;
  }
  const geometry = shootingLocation.geometry;
  if (geometry.type === 'point') {
    points.push({
      id: geometry.point.id,
      kind: 'point',
      label: geometry.point.name || 'Point',
      latitude: geometry.point.latitude,
      longitude: geometry.point.longitude
    });
  } else if (geometry.type === 'path') {
    points.push({
      id: geometry.start.id,
      kind: 'start',
      label: geometry.start.name || 'Start',
      latitude: geometry.start.latitude,
      longitude: geometry.start.longitude
    });
    points.push({
      id: geometry.end.id,
      kind: 'end',
      label: geometry.end.name || 'End',
      latitude: geometry.end.latitude,
      longitude: geometry.end.longitude
    });
  } else {
    for (const point of geometry.points) {
      points.push({
        id: point.id,
        kind: 'point',
        label: point.name || 'Point',
        latitude: point.latitude,
        longitude: point.longitude
      });
    }
  }
  return points;
}

export default function SavedLocationMap({
  target = null,
  shootingLocation = null,
  editable = false,
  onMarkerMove = () => {},
  fitId = 0,
  initialViewport = null,
  onViewportChange = () => {}
}: SavedLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<string, MapLibreMarker>>(new Map());
  const initialViewportRef = useRef(initialViewport);
  const [mapFailed, setMapFailed] = useState(false);

  const handlersRef = useRef({ onMarkerMove, onViewportChange });
  handlersRef.current = { onMarkerMove, onViewportChange };

  const mapPoints = useMemo(() => collectMapPoints(target, shootingLocation), [target, shootingLocation]);

  const dataRef = useRef({ target, shootingLocation, editable });
  dataRef.current = { target, shootingLocation, editable };

  const pathPolyline = useMemo(() => {
    if (!shootingLocation || shootingLocation.geometry.type !== 'path') {
      return null;
    }
    const start = shootingLocation.geometry.start;
    const end = shootingLocation.geometry.end;
    const lengthKm = pathTotalLengthKm(start, end);
    const bearingDegrees = initialBearing(start.latitude, start.longitude, end.latitude, end.longitude);
    const polyline: Array<[number, number]> = [];
    const steps = 64;
    for (let index = 0; index <= steps; index++) {
      const point = pathPointAtFraction(start, end, lengthKm, bearingDegrees, index / steps);
      polyline.push([point.longitude, point.latitude]);
    }
    return polyline;
  }, [shootingLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const markers = markerRefs.current;
    let map: MapLibreMap;
    try {
      const style: StyleSpecification = getMapStyle('osm').style;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [103.89, 1.315],
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
      map.addSource('path-line', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'path-line',
        type: 'line',
        source: 'path-line',
        paint: { 'line-color': PATH_COLOR, 'line-width': 4.5 }
      });

      syncMarkers(map, dataRef.current.target, dataRef.current.shootingLocation);

      const storedViewport = initialViewportRef.current;
      if (storedViewport) {
        map.setZoom(storedViewport.zoom);
        map.setCenter([storedViewport.longitude, storedViewport.latitude]);
      } else {
        fitMap(map);
      }
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      handlersRef.current.onViewportChange({ longitude: center.lng, latitude: center.lat, zoom: map.getZoom() });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    syncMarkers(map, dataRef.current.target, dataRef.current.shootingLocation);

    const pathSource = map.getSource('path-line') as GeoJSONSource | undefined;
    pathSource?.setData(lineFeature(pathPolyline ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPoints, pathPolyline, editable, shootingLocation, target]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    fitMap(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitId]);

  function syncMarkers(map: MapLibreMap, currentTarget: SavedLocationMapProps['target'], currentLocation: SavedLocationMapProps['shootingLocation']) {
    const existing = markerRefs.current;
    const points = collectMapPoints(currentTarget, currentLocation);
    const desiredIds = new Set(points.map((point) => point.id));

    for (const [id, marker] of existing) {
      if (!desiredIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    for (const point of points) {
      const existingMarker = existing.get(point.id);
      if (!existingMarker) {
        const element = buildElementFor(point.kind);
        element.setAttribute('aria-label', point.label);
        const popup = new maplibregl.Popup({ closeButton: false, offset: 18 });
        const created = new maplibregl.Marker({ element, draggable: dataRef.current.editable, anchor: 'bottom' })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(popup.setDOMContent(buildPointPopup(point.label, point.latitude, point.longitude)))
          .addTo(map);
        created.on('drag', () => {
          const position = created.getLngLat();
          handlersRef.current.onMarkerMove(point.id, position.lat, position.lng);
          const popupRef = created.getPopup?.();
          if (popupRef) {
            popupRef.setDOMContent(buildPointPopup(point.label, position.lat, position.lng));
          }
        });
        existing.set(point.id, created);
      } else {
        const position = existingMarker.getLngLat();
        if (
          Math.abs(position.lat - point.latitude) > 1e-9 ||
          Math.abs(position.lng - point.longitude) > 1e-9
        ) {
          existingMarker.setLngLat([point.longitude, point.latitude]);
        }
        existingMarker.setDraggable(dataRef.current.editable);
        const popup = existingMarker.getPopup?.();
        if (popup) {
          popup.setDOMContent(buildPointPopup(point.label, point.latitude, point.longitude));
        }
      }
    }
  }

  function buildElementFor(kind: SavedMapPoint['kind']): HTMLElement {
    if (kind === 'target') {
      return buildPinElement(TARGET_COLOR);
    }
    if (kind === 'start') {
      return buildAreaMarkerElement('S', START_COLOR);
    }
    if (kind === 'end') {
      return buildAreaMarkerElement('E', END_COLOR);
    }
    return buildCameraElement(POINT_COLOR, 0.8);
  }

  function fitMap(map: MapLibreMap) {
    const points = collectMapPoints(dataRef.current.target, dataRef.current.shootingLocation);
    if (points.length === 0) {
      map.setZoom(13);
      return;
    }
    const coordinates = points.map((point) => [point.longitude, point.latitude] as [number, number]);
    if (coordinates.length === 1) {
      map.setCenter(coordinates[0]);
      map.setZoom(13);
      return;
    }
    const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
    for (const [longitude, latitude] of coordinates) {
      bounds.extend([longitude, latitude]);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
  }

  if (mapFailed) {
    return (
      <div
        data-testid="saved-locations-map-unavailable"
        className="flex h-[380px] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 text-center"
      >
        <p className="text-sm font-semibold text-slate-200">Map unavailable</p>
        <p className="max-w-xs text-sm text-slate-400">You can still use the list below.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800">
      <div ref={containerRef} data-testid="saved-locations-map" className="h-[380px] w-full" />
      <button
        type="button"
        onClick={() => fitMap(mapRef.current!)}
        data-testid="saved-locations-recentre"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Recentre
      </button>
      {savedPointCount(
        shootingLocation?.geometry ?? { type: 'points', points: [] }
      ) === 0 && !target && (
        <p className="absolute left-3 top-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-300 shadow-lg">
          Select a saved item to preview it here.
        </p>
      )}
    </div>
  );
}
