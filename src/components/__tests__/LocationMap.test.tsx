import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LocationMap from '../LocationMap';

const { MockMap, MockMarker, MockLngLatBounds, MockGeoJSONSource, MockNavigationControl } = vi.hoisted(() => {
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
    lngLat: { lat: number; lng: number };
    handlers: Record<string, () => void> = {};
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.lngLat = { lat: 0, lng: 0 };
      MockMarker.instances.push(this);
    }

    setLngLat(lngLat: { lat: number; lng: number } | [number, number]) {
      this.lngLat = Array.isArray(lngLat) ? { lng: lngLat[0], lat: lngLat[1] } : lngLat;
      return this;
    }

    getLngLat() {
      return this.lngLat;
    }

    on(event: string, callback: () => void) {
      this.handlers[event] = callback;
      return this;
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

    remove() {}
  }

  return { MockMap, MockMarker, MockLngLatBounds, MockGeoJSONSource, MockNavigationControl };
});

vi.mock('maplibre-gl', () => ({
  __esModule: true,
  default: {
    Map: MockMap,
    Marker: MockMarker,
    LngLatBounds: MockLngLatBounds,
    NavigationControl: MockNavigationControl
  },
  MockMap,
  MockMarker,
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

function markerElement(label: string): HTMLElement {
  const marker = findMarkerByLabel(label);
  return marker?.options.element as HTMLElement;
}

function lineCoordinates(source: InstanceType<typeof MockGeoJSONSource>): Array<[number, number]> {
  const data = source.data as { geometry: { coordinates: Array<[number, number]> } };
  return data.geometry.coordinates;
}

const PROPS = {
  observer: OBSERVER,
  target: TARGET,
  activeLocation: 'observer' as const,
  onObserverMove: vi.fn(),
  onTargetMove: vi.fn(),
  onActivate: vi.fn()
};

beforeEach(() => {
  MockMap.instances = [];
  MockMarker.instances = [];
  MockMap.shouldThrow = false;
  PROPS.onObserverMove.mockReset();
  PROPS.onTargetMove.mockReset();
  PROPS.onActivate.mockReset();
});

function loadMap() {
  act(() => {
    MockMap.instances[0]?.handlers.load?.();
  });
}

describe('LocationMap', () => {
  it('places the observer and target markers at their coordinates with fixed aria labels', () => {
    render(<LocationMap {...PROPS} />);
    loadMap();

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: OBSERVER.longitude, lat: OBSERVER.latitude });
    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lng: TARGET.longitude, lat: TARGET.latitude });
  });

  it('labels the target marker chip with the landmark name', () => {
    render(<LocationMap {...PROPS} targetName="Marina Bay Sands" />);
    loadMap();

    expect(markerElement('Target').textContent).toContain('Marina Bay Sands');
    expect(markerElement('Observer').textContent).toContain('Observer');
  });

  it('draws the observer-to-target line with the correct coordinates', () => {
    render(<LocationMap {...PROPS} />);
    loadMap();

    const source = MockMap.instances[0].sources['observer-target-line'];
    expect(lineCoordinates(source)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [TARGET.longitude, TARGET.latitude]
    ]);
  });

  it('marks the active location on its marker and dims the other marker', () => {
    const { rerender } = render(<LocationMap {...PROPS} />);
    loadMap();

    expect(markerElement('Observer').getAttribute('data-marker-active')).toBe('true');
    expect(markerElement('Target').getAttribute('data-marker-active')).toBe('false');

    rerender(<LocationMap {...PROPS} activeLocation="target" />);

    expect(markerElement('Observer').getAttribute('data-marker-active')).toBe('false');
    expect(markerElement('Target').getAttribute('data-marker-active')).toBe('true');
  });

  it('moves only the active marker when the map is clicked', () => {
    render(<LocationMap {...PROPS} />);
    loadMap();

    act(() => {
      MockMap.instances[0].handlers.click?.({ lngLat: { lat: 9, lng: 9 } });
    });

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lat: 9, lng: 9 });
    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lng: TARGET.longitude, lat: TARGET.latitude });
    expect(PROPS.onObserverMove).toHaveBeenCalledWith(9, 9);
    expect(PROPS.onTargetMove).not.toHaveBeenCalled();
  });

  it('moves the target marker when it is the active location', () => {
    render(<LocationMap {...PROPS} activeLocation="target" />);
    loadMap();

    act(() => {
      MockMap.instances[0].handlers.click?.({ lngLat: { lat: 9, lng: 9 } });
    });

    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lat: 9, lng: 9 });
    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: OBSERVER.longitude, lat: OBSERVER.latitude });
    expect(PROPS.onTargetMove).toHaveBeenCalledWith(9, 9);
    expect(PROPS.onObserverMove).not.toHaveBeenCalled();
  });

  it('dragging a marker moves it and activates it even when another location is selected', () => {
    render(<LocationMap {...PROPS} activeLocation="observer" />);
    loadMap();

    const targetMarker = findMarkerByLabel('Target');
    expect(targetMarker).toBeTruthy();
    targetMarker!.lngLat = { lat: 2.1, lng: 101.9 };

    act(() => {
      targetMarker!.handlers.dragstart?.();
      targetMarker!.handlers.drag?.();
    });

    expect(PROPS.onActivate).toHaveBeenCalledWith('target');
    expect(PROPS.onTargetMove).toHaveBeenCalledWith(2.1, 101.9);
  });

  it('syncs markers and the line when the coordinates change', () => {
    const { rerender } = render(<LocationMap {...PROPS} />);
    loadMap();

    const newObserver = { latitude: 2, longitude: 100 };
    rerender(<LocationMap {...PROPS} observer={newObserver} />);

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: 100, lat: 2 });
    const source = MockMap.instances[0].sources['observer-target-line'];
    expect(lineCoordinates(source)).toEqual([
      [100, 2],
      [TARGET.longitude, TARGET.latitude]
    ]);
  });

  it('fits the viewport to include both locations on load', () => {
    render(<LocationMap {...PROPS} />);
    loadMap();

    const map = MockMap.instances[0];
    expect(map.fitCalls.length).toBeGreaterThanOrEqual(1);
    const fit = map.fitCalls[map.fitCalls.length - 1];
    expect(fit.options).toHaveProperty('padding', 70);
    const points = fit.bounds.points;
    expect(points.some(([lng, lat]) => lng === OBSERVER.longitude && lat === OBSERVER.latitude)).toBe(true);
    expect(points.some(([lng, lat]) => lng === TARGET.longitude && lat === TARGET.latitude)).toBe(true);
  });

  it('refits the viewport when fitId changes', () => {
    const { rerender } = render(<LocationMap {...PROPS} fitId={0} />);
    loadMap();

    const before = MockMap.instances[0].fitCalls.length;
    rerender(<LocationMap {...PROPS} fitId={1} />);

    expect(MockMap.instances[0].fitCalls.length).toBeGreaterThan(before);
  });

  it('refits the viewport when the fit button is clicked', () => {
    render(<LocationMap {...PROPS} />);
    loadMap();

    const before = MockMap.instances[0].fitCalls.length;
    fireEvent.click(screen.getByTestId('fit-locations-button'));

    expect(MockMap.instances[0].fitCalls.length).toBeGreaterThan(before);
  });

  it('shows a graceful fallback when the map cannot be created', () => {
    MockMap.shouldThrow = true;
    render(<LocationMap {...PROPS} />);

    expect(screen.getByTestId('location-map-unavailable').textContent).toContain('Map unavailable');
    expect(MockMap.instances).toHaveLength(0);
  });
});
