'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { ShootingLocation } from '../lib/reverseSearch/types';
import { getMapStyle } from '../lib/map/mapConfig';

interface ShootingLocationMapProps {
  target: { latitude: number; longitude: number };
  candidates: ShootingLocation[];
  idealLine: Array<[number, number]>;
  corridorPolygon: Array<[number, number]>;
  searchCircle: Array<[number, number]>;
  selectedId: string | null;
  onSelect: (_id: string) => void;
  styleId?: string;
}

function pointFeature(latitude: number, longitude: number, properties: Record<string, unknown>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [longitude, latitude] },
    properties
  };
}

function lineFeature(coordinates: Array<[number, number]>, properties: Record<string, unknown> = {}) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties
  };
}

function polygonFeature(coordinates: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
    properties: {}
  };
}

export default function ShootingLocationMap({
  target,
  candidates,
  idealLine,
  corridorPolygon,
  searchCircle,
  selectedId,
  onSelect,
  styleId = 'osm'
}: ShootingLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const fitKeyRef = useRef('');

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const style: StyleSpecification = getMapStyle(styleId).style;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [target.longitude, target.latitude],
      zoom: 13,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('target-point', {
        type: 'geojson',
        data: pointFeature(target.latitude, target.longitude, {})
      });
      map.addSource('ideal-line', {
        type: 'geojson',
        data: lineFeature(idealLine, {})
      });
      map.addSource('corridor', {
        type: 'geojson',
        data: polygonFeature(corridorPolygon)
      });
      map.addSource('search-circle', {
        type: 'geojson',
        data: lineFeature(searchCircle, {})
      });
      map.addSource('candidates', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({ id: 'search-circle', type: 'line', source: 'search-circle', paint: { 'line-color': '#334155', 'line-width': 1.5, 'line-dasharray': [3, 3] } });
      map.addLayer({ id: 'corridor-fill', type: 'fill', source: 'corridor', paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'corridor-outline', type: 'line', source: 'corridor', paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
      map.addLayer({ id: 'ideal-line', type: 'line', source: 'ideal-line', paint: { 'line-color': '#f43f5e', 'line-width': 2.5, 'line-dasharray': [4, 3] } });
      map.addLayer({ id: 'target-marker', type: 'symbol', source: 'target-point', layout: { 'text-field': '🎯', 'text-size': 26, 'text-anchor': 'center' } });
      map.addLayer({ id: 'candidates-base', type: 'circle', source: 'candidates', paint: { 'circle-color': '#38bdf8', 'circle-radius': 8, 'circle-stroke-color': '#f8fafc', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'candidates-selected', type: 'circle', source: 'candidates', filter: ['==', ['get', 'selected'], 1], paint: { 'circle-color': '#f59e0b', 'circle-radius': 11, 'circle-stroke-color': '#f8fafc', 'circle-stroke-width': 3 } });

      map.on('click', 'candidates-base', (event) => {
        const feature = event.features?.[0];
        if (feature?.properties?.id) {
          onSelectRef.current(String(feature.properties.id));
        }
      });
      map.on('mouseenter', 'candidates-base', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'candidates-base', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const candidatesSource = map.getSource('candidates') as GeoJSONSource | undefined;
    if (candidatesSource) {
      candidatesSource.setData({
        type: 'FeatureCollection',
        features: candidates.map((candidate) =>
          pointFeature(candidate.latitude, candidate.longitude, {
            id: candidate.id,
            selected: candidate.id === selectedId ? 1 : 0,
            error: candidate.alignmentError
          })
        )
      });
    }

    const targetSource = map.getSource('target-point') as GeoJSONSource | undefined;
    targetSource?.setData(pointFeature(target.latitude, target.longitude, {}));
    (map.getSource('ideal-line') as GeoJSONSource | undefined)?.setData(lineFeature(idealLine, {}));
    (map.getSource('corridor') as GeoJSONSource | undefined)?.setData(polygonFeature(corridorPolygon));
    (map.getSource('search-circle') as GeoJSONSource | undefined)?.setData(lineFeature(searchCircle, {}));

    const fitKey = `${target.latitude},${target.longitude},${idealLine[0]?.[0]},${candidates.length}`;
    if (fitKey !== fitKeyRef.current) {
      fitKeyRef.current = fitKey;
      const bounds = new maplibregl.LngLatBounds([target.longitude, target.latitude], [target.longitude, target.latitude]);
      for (const candidate of candidates) {
        bounds.extend([candidate.longitude, candidate.latitude]);
      }
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 600 });
    }
  }, [target, candidates, idealLine, corridorPolygon, searchCircle, selectedId]);

  return <div ref={containerRef} data-testid="shooting-location-map" className="h-[440px] w-full rounded-2xl" />;
}
