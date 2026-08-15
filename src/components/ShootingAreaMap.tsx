'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from 'maplibre-gl';
import type { GeographicPoint } from '../types/astronomy';
import type { ShootingArea, ShootingOpportunity } from '../lib/opportunities/types';
import { getMapStyle } from '../lib/map/mapConfig';
import { buildCameraCanvas, buildCameraElement, buildPinElement } from '../lib/map/markers';
import { pathPointAtFraction, pathTotalLengthKm } from '../lib/opportunities/pathGeometry';
import { initialBearing } from '../lib/geometry/bearing';
import { destinationPoint } from '../lib/geometry/destinationPoint';
import { greatCircleDistanceKm } from '../lib/geometry/distance';

export interface AreaCameraMarker {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  color?: string;
}

export interface ShootingAreaHighlight {
  zoneStartKm: number;
  zoneEndKm: number;
  directionAzimuth: number;
}

interface ShootingAreaMapProps {
  target: GeographicPoint;
  targetName?: string | null;
  area: ShootingArea;
  cameraMarkers: AreaCameraMarker[];
  onTargetMove: (_latitude: number, _longitude: number) => void;
  onAreaCameraMove: (_id: string, _latitude: number, _longitude: number) => void;
  highlight?: ShootingAreaHighlight | null;
  opportunities: ShootingOpportunity[];
  selectedId: string | null;
  onSelect: (_id: string) => void;
  fitId?: number;
}

const TARGET_COLOR = '#f59e0b';
const PATH_COLOR = '#38bdf8';
const ZONE_COLOR = '#f59e0b';
const DIRECTION_COLOR = '#f43f5e';

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {}
  };
}

function pointFeature(id: string, latitude: number, longitude: number, selected: boolean) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [longitude, latitude] },
    properties: { id, selected: selected ? 1 : 0 }
  };
}

function featureCollection(features: ReturnType<typeof pointFeature>[]) {
  return { type: 'FeatureCollection' as const, features };
}

export default function ShootingAreaMap({
  target,
  targetName = null,
  area,
  cameraMarkers,
  onTargetMove,
  onAreaCameraMove,
  highlight = null,
  opportunities,
  selectedId,
  onSelect,
  fitId = 0
}: ShootingAreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const targetMarkerRef = useRef<MapLibreMarker | null>(null);
  const cameraMarkerRefs = useRef<Map<string, MapLibreMarker>>(new Map());
  const [mapFailed, setMapFailed] = useState(false);

  const handlersRef = useRef({ onTargetMove, onAreaCameraMove, onSelect });
  handlersRef.current = { onTargetMove, onAreaCameraMove, onSelect };

  const dataRef = useRef({ target, area, cameraMarkers, highlight, opportunities, selectedId });
  dataRef.current = { target, area, cameraMarkers, highlight, opportunities, selectedId };

  const isPathMode = area.type === 'path';

  const pathGeometry = useMemo(() => {
    if (!isPathMode) {
      return null;
    }
    const start = area.start;
    const end = area.end;
    const lengthKm = pathTotalLengthKm(start, end);
    const bearingDegrees = initialBearing(start.latitude, start.longitude, end.latitude, end.longitude);
    const polyline: Array<[number, number]> = [];
    const steps = 64;
    for (let index = 0; index <= steps; index++) {
      const point = pathPointAtFraction(start, end, lengthKm, bearingDegrees, index / steps);
      polyline.push([point.longitude, point.latitude]);
    }
    return { lengthKm, bearingDegrees, polyline };
  }, [area, isPathMode]);

  const zonePolyline = useMemo(() => {
    if (!isPathMode || !highlight || !pathGeometry) {
      return null;
    }
    const start = area.start;
    const end = area.end;
    const lengthKm = pathGeometry.lengthKm;
    const bearingDegrees = pathGeometry.bearingDegrees;
    if (lengthKm < 1e-9) {
      return null;
    }
    const startFraction = Math.max(0, Math.min(1, highlight.zoneStartKm / lengthKm));
    const endFraction = Math.max(0, Math.min(1, highlight.zoneEndKm / lengthKm));
    const polyline: Array<[number, number]> = [];
    const steps = 24;
    for (let index = 0; index <= steps; index++) {
      const fraction = startFraction + ((endFraction - startFraction) * index) / steps;
      const point = pathPointAtFraction(start, end, lengthKm, bearingDegrees, fraction);
      polyline.push([point.longitude, point.latitude]);
    }
    return polyline;
  }, [area, isPathMode, highlight, pathGeometry]);

  const directionLine = useMemo(() => {
    if (!highlight) {
      return null;
    }
    const maxDistanceKm = cameraMarkers.reduce(
      (max, marker) =>
        Math.max(max, greatCircleDistanceKm(target.latitude, target.longitude, marker.latitude, marker.longitude)),
      0
    );
    const lengthKm = Math.max(maxDistanceKm * 1.6, 1);
    const endpoint = destinationPoint(target.latitude, target.longitude, highlight.directionAzimuth, lengthKm);
    return [
      [target.longitude, target.latitude],
      [endpoint.longitude, endpoint.latitude]
    ] as Array<[number, number]>;
  }, [highlight, target, cameraMarkers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const cameraMarkers = cameraMarkerRefs.current;
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
      setMapFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      const imageData = buildCameraCanvas('#38bdf8').getContext('2d')?.getImageData(0, 0, 160, 160);
      const selectedImageData = buildCameraCanvas('#f59e0b').getContext('2d')?.getImageData(0, 0, 160, 160);
      if (imageData) {
        map.addImage('opportunity-camera', imageData);
      }
      if (selectedImageData) {
        map.addImage('opportunity-camera-selected', selectedImageData);
      }

      map.addSource('opportunities', { type: 'geojson', data: featureCollection([]) });
      map.addLayer({
        id: 'opportunities-layer',
        type: 'symbol',
        source: 'opportunities',
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'selected'], 1],
            'opportunity-camera-selected',
            'opportunity-camera'
          ],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-size': 0.45
        }
      });

      map.addSource('path-line', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'path-line',
        type: 'line',
        source: 'path-line',
        paint: { 'line-color': PATH_COLOR, 'line-width': 3, 'line-dasharray': [1.5, 1.5] }
      });

      map.addSource('zone-line', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: 'zone-line',
        paint: { 'line-color': ZONE_COLOR, 'line-width': 6, 'line-opacity': 0.75 }
      });

      map.addSource('direction-line', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'direction-line',
        type: 'line',
        source: 'direction-line',
        paint: { 'line-color': DIRECTION_COLOR, 'line-width': 2.5, 'line-dasharray': [4, 3] }
      });

      map.on('click', 'opportunities-layer', (event) => {
        const feature = event.features?.[0];
        if (feature?.properties?.id) {
          handlersRef.current.onSelect(String(feature.properties.id));
        }
      });
      map.on('mouseenter', 'opportunities-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'opportunities-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      const targetBuilt = buildPinElement(TARGET_COLOR);
      targetBuilt.setAttribute('aria-label', 'Target');
      const targetMarker = new maplibregl.Marker({ element: targetBuilt, draggable: true, anchor: 'bottom' })
        .setLngLat([target.longitude, target.latitude])
        .addTo(map);
      targetMarker.on('drag', () => {
        const position = targetMarker.getLngLat();
        handlersRef.current.onTargetMove(position.lat, position.lng);
      });
      targetMarkerRef.current = targetMarker;

      syncCameraMarkers(map, dataRef.current.cameraMarkers);
      fitMap(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      targetMarkerRef.current = null;
      cameraMarkers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const current = dataRef.current;
    const targetMarker = targetMarkerRef.current;
    if (targetMarker) {
      const position = targetMarker.getLngLat();
      if (
        Math.abs(position.lat - current.target.latitude) > 1e-9 ||
        Math.abs(position.lng - current.target.longitude) > 1e-9
      ) {
        targetMarker.setLngLat([current.target.longitude, current.target.latitude]);
      }
      const popup = targetMarker.getPopup?.();
      if (popup) {
        popup.setDOMContent(buildTargetPopup(targetName, current.target.latitude, current.target.longitude));
      }
    }

    syncCameraMarkers(map, current.cameraMarkers);

    const pathSource = map.getSource('path-line') as GeoJSONSource | undefined;
    pathSource?.setData(lineFeature(pathGeometry?.polyline ?? []));

    const zoneSource = map.getSource('zone-line') as GeoJSONSource | undefined;
    zoneSource?.setData(lineFeature(zonePolyline ?? []));

    const directionSource = map.getSource('direction-line') as GeoJSONSource | undefined;
    directionSource?.setData(lineFeature(directionLine ?? []));

    const opportunitiesSource = map.getSource('opportunities') as GeoJSONSource | undefined;
    opportunitiesSource?.setData(
      featureCollection(
        current.opportunities.map((opportunity) =>
          pointFeature(opportunity.id, opportunity.position.latitude, opportunity.position.longitude, opportunity.id === current.selectedId)
        )
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, targetName, cameraMarkers, pathGeometry, zonePolyline, directionLine, opportunities, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    fitMap(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitId]);

  function syncCameraMarkers(map: MapLibreMap, markers: AreaCameraMarker[]) {
    const existing = cameraMarkerRefs.current;
    const desiredIds = new Set(markers.map((marker) => marker.id));

    for (const [id, marker] of existing) {
      if (!desiredIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    for (const marker of markers) {
      const existingMarker = existing.get(marker.id);
      if (!existingMarker) {
        const element = buildCameraElement(marker.color ?? '#38bdf8');
        element.setAttribute('aria-label', marker.label);
        const created = new maplibregl.Marker({ element, draggable: true, anchor: 'bottom' })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
        created.on('drag', () => {
          const position = created.getLngLat();
          handlersRef.current.onAreaCameraMove(marker.id, position.lat, position.lng);
        });
        existing.set(marker.id, created);
      } else {
        const position = existingMarker.getLngLat();
        if (
          Math.abs(position.lat - marker.latitude) > 1e-9 ||
          Math.abs(position.lng - marker.longitude) > 1e-9
        ) {
          existingMarker.setLngLat([marker.longitude, marker.latitude]);
        }
      }
    }
  }

  function fitMap(map: MapLibreMap) {
    const current = dataRef.current;
    const points: Array<[number, number]> = [[current.target.longitude, current.target.latitude]];
    for (const marker of current.cameraMarkers) {
      points.push([marker.longitude, marker.latitude]);
    }
    for (const opportunity of current.opportunities) {
      points.push([opportunity.position.longitude, opportunity.position.latitude]);
    }
    const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
    for (const [longitude, latitude] of points) {
      bounds.extend([longitude, latitude]);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
  }

  if (mapFailed) {
    return (
      <div
        data-testid="shooting-area-map-unavailable"
        className="flex h-[420px] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 text-center"
      >
        <p className="text-sm font-semibold text-slate-200">Map unavailable</p>
        <p className="max-w-xs text-sm text-slate-400">You can still enter coordinates below.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800">
      <div ref={containerRef} data-testid="shooting-area-map" className="h-[420px] w-full lg:h-[520px]" />
      <button
        type="button"
        onClick={() => fitMap(mapRef.current!)}
        data-testid="shooting-area-recentre"
        className="absolute bottom-3 right-3 z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg transition hover:border-slate-500 hover:text-white"
      >
        Recentre
      </button>
    </div>
  );
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
