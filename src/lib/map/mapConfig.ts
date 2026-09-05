import type { StyleSpecification } from 'maplibre-gl';

export interface MapStyleConfig {
  id: string;
  label: string;
  style: StyleSpecification;
  isSatellite: boolean;
}

const osmStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-basemap',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-opacity': 1
      }
    }
  ]
};

export const MAP_STYLES: MapStyleConfig[] = [
  {
    id: 'osm',
    label: 'Streets',
    style: osmStyle,
    isSatellite: false
  }
];

export function getMapStyle(styleId: string): MapStyleConfig {
  return MAP_STYLES.find((config) => config.id === styleId) ?? MAP_STYLES[0];
}
