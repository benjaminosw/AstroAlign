import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import AlignmentMap from '../AlignmentMap';
import { directionEndpoint, directionLengthKm } from '../../lib/map/alignmentGeometry';

const { MockMap, MockMarker, MockPopup, MockLngLatBounds, MockGeoJSONSource, MockNavigationControl } = vi.hoisted(() => {
  class MockPopup {
    content: HTMLElement | null = null;
    setDOMContent(node: HTMLElement) {
      this.content = node;
      return this;
    }
  }

  class MockGeoJSONSource {
    data: unknown = null;
    constructor(data: unknown) {
      this.data = data;
    }
    setData(data: unknown) {
      this.data = data;
    }
  }

  class MockMarker {
    static instances: MockMarker[] = [];
    lngLat: { lat: number; lng: number } | null = null;
    popup: MockPopup | null = null;
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      MockMarker.instances.push(this);
    }

    setLngLat(lngLat: { lat: number; lng: number } | [number, number]) {
      this.lngLat = Array.isArray(lngLat) ? { lng: lngLat[0], lat: lngLat[1] } : lngLat;
      return this;
    }

    setPopup(popup: MockPopup) {
      this.popup = popup;
      return this;
    }

    getPopup() {
      return this.popup;
    }

    addTo() {
      return this;
    }
  }

  class MockLngLatBounds {
    points: Array<[number, number]> = [];
    constructor(sw: [number, number], ne: [number, number]) {
      this.points.push(sw);
      this.points.push(ne);
    }
    extend(point: [number, number]) {
      this.points.push(point);
      return this;
    }
  }

  class MockNavigationControl {}

  class MockMap {
    static instances: MockMap[] = [];
    static shouldThrow = false;
    handlers: Record<string, (_event?: unknown) => void> = {};
    sources: Record<string, MockGeoJSONSource> = {};
    layers: string[] = [];
    fitCalls: Array<{ bounds: MockLngLatBounds; options: Record<string, unknown> }> = [];

    constructor(_options: Record<string, unknown>) {
      if (MockMap.shouldThrow) {
        throw new Error('map failed');
      }
      MockMap.instances.push(this);
    }

    on(event: string, callback: (_event?: unknown) => void) {
      this.handlers[event] = callback;
      return this;
    }

    addControl() {
      return this;
    }

    addSource(name: string, options: { type: string; data: unknown }) {
      this.sources[name] = new MockGeoJSONSource(options.data);
    }

    addLayer(options: { id: string }) {
      this.layers.push(options.id);
    }

    getSource(name: string) {
      return this.sources[name];
    }

    isStyleLoaded() {
      return true;
    }

    fitBounds(bounds: MockLngLatBounds, options: Record<string, unknown>) {
      this.fitCalls.push({ bounds, options });
      return this;
    }

    getCanvas() {
      return { style: {} };
    }

    remove() {}
  }

  return { MockMap, MockMarker, MockPopup, MockLngLatBounds, MockGeoJSONSource, MockNavigationControl };
});

vi.mock('maplibre-gl', () => ({
  __esModule: true,
  default: {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
    NavigationControl: MockNavigationControl
  },
  MockMap,
  MockMarker,
  MockPopup,
  MockLngLatBounds,
  MockGeoJSONSource,
  MockNavigationControl
}));

const OBSERVER = { latitude: 1.3127197143335354, longitude: 103.88002586269513 };
const TARGET = { latitude: 1.315079159356616, longitude: 103.89212097301142 };

function findMarkerByLabel(label: string) {
  return MockMarker.instances.find((marker) => {
    const element = marker.options.element as HTMLElement | undefined;
    return element?.getAttribute('aria-label') === label;
  });
}

function lineCoordinates(source: InstanceType<typeof MockGeoJSONSource>): Array<[number, number]> {
  const data = source.data as { geometry: { coordinates: Array<[number, number]> } };
  return data.geometry.coordinates;
}

beforeEach(() => {
  MockMap.instances = [];
  MockMarker.instances = [];
  MockMap.shouldThrow = false;
});

function loadMap() {
  act(() => {
    MockMap.instances[0]?.handlers.load?.();
  });
}

const PROPS = {
  observer: OBSERVER,
  target: TARGET,
  object: 'Sun' as const,
  objectAzimuth: 80.12,
  targetBearing: 78.96,
  targetDistanceKm: 1.35,
  angularSeparation: 1.5,
  toleranceDegrees: 0.5,
  withinTolerance: false
};

describe('AlignmentMap', () => {
  it('places the observer marker at the observer coordinates', () => {
    render(<AlignmentMap {...PROPS} />);
    loadMap();

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: OBSERVER.longitude, lat: OBSERVER.latitude });
  });

  it('places the target marker at the target coordinates', () => {
    render(<AlignmentMap {...PROPS} />);
    loadMap();

    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lng: TARGET.longitude, lat: TARGET.latitude });
  });

  it('draws the observer-to-target line with the correct coordinates', () => {
    render(<AlignmentMap {...PROPS} />);
    loadMap();

    const source = MockMap.instances[0].sources['target-line'];
    expect(lineCoordinates(source)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [TARGET.longitude, TARGET.latitude]
    ]);
  });

  it('draws the astronomical direction using the calculated azimuth', () => {
    const azimuth = 103.38;
    render(<AlignmentMap {...PROPS} objectAzimuth={azimuth} />);
    loadMap();

    const endpoint = directionEndpoint(OBSERVER, azimuth, directionLengthKm(PROPS.targetDistanceKm));
    const source = MockMap.instances[0].sources['object-line'];
    expect(lineCoordinates(source)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);
  });

  it('marks the object direction with the correct symbol and label', () => {
    render(<AlignmentMap {...PROPS} object="Moon" azimuthLabel="Moonrise azimuth" />);
    loadMap();

    const marker = findMarkerByLabel('Moon direction');
    const element = marker?.options.element as HTMLElement;
    expect(element?.textContent).toContain('🌙');
    expect(element?.textContent).toContain('Moon');
    expect(marker?.popup?.content?.textContent).toContain('Moonrise azimuth direction');
    expect(marker?.popup?.content?.textContent).toContain('Azimuth: 80.12°');
  });

  it('shows the alignment status overlay from the calculated values', () => {
    render(<AlignmentMap {...PROPS} angularSeparation={0.04} withinTolerance={true} toleranceDegrees={0.5} />);
    loadMap();

    const overlay = document.querySelector('[data-testid="alignment-status"]');
    expect(overlay?.textContent).toContain('Target bearing');
    expect(overlay?.textContent).toContain('78.96°');
    expect(overlay?.textContent).toContain('Sun azimuth');
    expect(overlay?.textContent).toContain('80.12°');
    expect(overlay?.textContent).toContain('0.04°');
    expect(overlay?.textContent).toContain('✓ Within 0.5° tolerance');
  });

  it('fits the viewport to include observer, target, and the direction endpoint', () => {
    render(<AlignmentMap {...PROPS} />);
    loadMap();

    const fit = MockMap.instances[0].fitCalls[0];
    expect(fit.options).toHaveProperty('padding');
    const points = fit.bounds.points;
    expect(points.some(([lng, lat]) => lng === OBSERVER.longitude && lat === OBSERVER.latitude)).toBe(true);
    expect(points.some(([lng, lat]) => lng === TARGET.longitude && lat === TARGET.latitude)).toBe(true);
    const endpoint = directionEndpoint(OBSERVER, PROPS.objectAzimuth, directionLengthKm(PROPS.targetDistanceKm));
    expect(points.some(([lng, lat]) => lng === endpoint.longitude && lat === endpoint.latitude)).toBe(true);
  });

  it('re-fits the viewport when fitId changes', () => {
    const { rerender } = render(<AlignmentMap {...PROPS} fitId={0} />);
    loadMap();

    const before = MockMap.instances[0].fitCalls.length;
    rerender(<AlignmentMap {...PROPS} fitId={1} />);

    expect(MockMap.instances[0].fitCalls.length).toBeGreaterThan(before);
  });

  it('clicking the map does not move the target marker', () => {
    render(<AlignmentMap {...PROPS} />);
    loadMap();

    const targetMarker = findMarkerByLabel('Target');
    const before = targetMarker?.lngLat;
    act(() => {
      MockMap.instances[0].handlers.click?.({ lngLat: { lat: 9, lng: 9 } });
    });

    expect(targetMarker?.lngLat).toEqual(before);
  });

  it('shows a graceful fallback when the map cannot be created', () => {
    MockMap.shouldThrow = true;
    render(<AlignmentMap {...PROPS} />);

    expect(document.querySelector('[data-testid="alignment-map-unavailable"]')?.textContent).toContain('Map unavailable');
    expect(MockMap.instances).toHaveLength(0);
  });

  it('keeps the status overlay and fit button interactive without a map', () => {
    MockMap.shouldThrow = true;
    render(<AlignmentMap {...PROPS} />);

    expect(document.querySelector('[data-testid="fit-alignment-button"]')).toBeNull();
  });
});
