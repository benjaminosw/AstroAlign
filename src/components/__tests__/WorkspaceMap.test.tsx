import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import WorkspaceMap from '../WorkspaceMap';
import { directionEndpoint, directionLengthKm } from '../../lib/map/alignmentGeometry';
import { greatCircleDistanceKm } from '../../lib/geometry/distance';

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
    lngLat: { lat: number; lng: number } = { lat: 0, lng: 0 };
    popup: MockPopup | null = null;
    handlers: Record<string, () => void> = {};
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      MockMarker.instances.push(this);
    }

    setLngLat(lngLat: { lat: number; lng: number } | [number, number]) {
      this.lngLat = Array.isArray(lngLat) ? { lng: lngLat[0], lat: lngLat[1] } : lngLat;
      return this;
    }

    getLngLat() {
      return this.lngLat;
    }

    setPopup(popup: MockPopup) {
      this.popup = popup;
      return this;
    }

    getPopup() {
      return this.popup;
    }

    on(event: string, callback: () => void) {
      this.handlers[event] = callback;
      return this;
    }

    addTo() {
      return this;
    }

    remove() {
      const index = MockMarker.instances.indexOf(this);
      if (index >= 0) {
        MockMarker.instances.splice(index, 1);
      }
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

    getLayer(id: string) {
      return this.layers.includes(id) ? { id } : undefined;
    }

    removeLayer(id: string) {
      this.layers = this.layers.filter((layer) => layer !== id);
    }

    getSource(name: string) {
      return this.sources[name];
    }

    removeSource(name: string) {
      delete this.sources[name];
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

const ALIGNMENT = {
  object: 'Sun' as const,
  objectAzimuth: 80.12,
  targetBearing: 78.96,
  targetDistanceKm: 1.35,
  angularSeparation: 1.5,
  toleranceDegrees: 0.5,
  withinTolerance: false
};

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

function sunEndpoint(azimuth: number) {
  const lengthKm = directionLengthKm(greatCircleDistanceKm(OBSERVER.latitude, OBSERVER.longitude, TARGET.latitude, TARGET.longitude));
  return directionEndpoint(OBSERVER, azimuth, lengthKm);
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

describe('WorkspaceMap', () => {
  it('places the observer and target markers at their coordinates with fixed aria labels', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: OBSERVER.longitude, lat: OBSERVER.latitude });
    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lng: TARGET.longitude, lat: TARGET.latitude });
  });

  it('anchors the markers at their geographic tip so the coordinate sits on the point', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const observerMarker = findMarkerByLabel('Observer');
    const targetMarker = findMarkerByLabel('Target');
    expect(observerMarker?.options.anchor).toBe('bottom');
    expect(targetMarker?.options.anchor).toBe('bottom');
    expect((observerMarker?.options.element as HTMLElement)?.textContent).toBe('📍');
    expect((targetMarker?.options.element as HTMLElement)?.querySelector('svg')?.getAttribute('viewBox')).toBe(
      '0 0 32 40'
    );
  });

  it('renders markers without permanent text labels underneath them', () => {
    render(<WorkspaceMap {...PROPS} targetName="Marina Bay Sands" />);
    loadMap();

    expect(markerElement('Observer').querySelector('svg')).toBeFalsy();
    expect(markerElement('Target').querySelector('svg')).toBeTruthy();
    expect(markerElement('Observer').textContent).toBe('📍');
    expect(markerElement('Target').textContent).toBe('');
  });

  it('keeps the observer camera and target pin visually distinct', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const observerIcon = markerElement('Observer').textContent ?? '';
    const targetIcon = markerElement('Target').querySelector('svg')?.innerHTML ?? '';
    expect(observerIcon).toBe('📍');
    expect(targetIcon).toContain('#f59e0b');
    expect(targetIcon).toContain('M16 1.5');
  });

  it('marks the active location on its marker and dims the other marker', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} />);
    loadMap();

    expect(markerElement('Observer').getAttribute('data-marker-active')).toBe('true');
    expect(markerElement('Target').getAttribute('data-marker-active')).toBe('false');

    rerender(<WorkspaceMap {...PROPS} activeLocation="target" />);

    expect(markerElement('Observer').getAttribute('data-marker-active')).toBe('false');
    expect(markerElement('Target').getAttribute('data-marker-active')).toBe('true');
  });

  it('moves only the active marker when the map is clicked', () => {
    render(<WorkspaceMap {...PROPS} />);
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
    render(<WorkspaceMap {...PROPS} activeLocation="target" />);
    loadMap();

    act(() => {
      MockMap.instances[0].handlers.click?.({ lngLat: { lat: 9, lng: 9 } });
    });

    expect(findMarkerByLabel('Target')?.lngLat).toEqual({ lat: 9, lng: 9 });
    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: OBSERVER.longitude, lat: OBSERVER.latitude });
    expect(PROPS.onTargetMove).toHaveBeenCalledWith(9, 9);
    expect(PROPS.onObserverMove).not.toHaveBeenCalled();
  });

  it('dragging a marker moves it, activates it, and does not move the viewport', () => {
    render(<WorkspaceMap {...PROPS} activeLocation="observer" />);
    loadMap();

    const fitsBefore = MockMap.instances[0].fitCalls.length;
    const targetMarker = findMarkerByLabel('Target');
    expect(targetMarker).toBeTruthy();
    targetMarker!.lngLat = { lat: 2.1, lng: 101.9 };

    act(() => {
      targetMarker!.handlers.dragstart?.();
      targetMarker!.handlers.drag?.();
    });

    expect(PROPS.onActivate).toHaveBeenCalledWith('target');
    expect(PROPS.onTargetMove).toHaveBeenCalledWith(2.1, 101.9);
    expect(MockMap.instances[0].fitCalls.length).toBe(fitsBefore);
  });

  it('syncs markers and the line when the coordinates change', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const newObserver = { latitude: 2, longitude: 100 };
    rerender(<WorkspaceMap {...PROPS} observer={newObserver} />);

    expect(findMarkerByLabel('Observer')?.lngLat).toEqual({ lng: 100, lat: 2 });
    const source = MockMap.instances[0].sources['observer-target-line'];
    expect(lineCoordinates(source)).toEqual([
      [100, 2],
      [TARGET.longitude, TARGET.latitude]
    ]);
  });

  it('does not change the viewport when the coordinates change', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const fitsBefore = MockMap.instances[0].fitCalls.length;
    rerender(<WorkspaceMap {...PROPS} observer={{ latitude: 2, longitude: 100 }} />);
    rerender(<WorkspaceMap {...PROPS} target={{ latitude: 3, longitude: 101 }} />);

    expect(MockMap.instances[0].fitCalls.length).toBe(fitsBefore);
  });

  it('does not change the viewport when the alignment overlay updates', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} alignment={ALIGNMENT} />);
    loadMap();

    const fitsBefore = MockMap.instances[0].fitCalls.length;
    rerender(<WorkspaceMap {...PROPS} alignment={{ ...ALIGNMENT, objectAzimuth: 91.5, withinTolerance: true }} />);

    expect(MockMap.instances[0].fitCalls.length).toBe(fitsBefore);
  });

  it('fits the viewport to include both locations on load', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const map = MockMap.instances[0];
    expect(map.fitCalls.length).toBeGreaterThanOrEqual(1);
    const fit = map.fitCalls[map.fitCalls.length - 1];
    expect(fit.options).toHaveProperty('padding', 70);
    const points = fit.bounds.points;
    expect(points.some(([lng, lat]) => lng === OBSERVER.longitude && lat === OBSERVER.latitude)).toBe(true);
    expect(points.some(([lng, lat]) => lng === TARGET.longitude && lat === TARGET.latitude)).toBe(true);
  });

  it('refits the viewport when the recentre button is clicked', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    const before = MockMap.instances[0].fitCalls.length;
    fireEvent.click(screen.getByTestId('recentre-button'));

    expect(MockMap.instances[0].fitCalls.length).toBeGreaterThan(before);
  });

  it('refits toward the target when fitId changes and fitTarget is target', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} fitId={0} fitTarget="target" />);
    loadMap();

    const before = MockMap.instances[0].fitCalls.length;
    rerender(<WorkspaceMap {...PROPS} fitId={1} fitTarget="target" />);

    expect(MockMap.instances[0].fitCalls.length).toBeGreaterThan(before);
    const fit = MockMap.instances[0].fitCalls[MockMap.instances[0].fitCalls.length - 1];
    expect(fit.options).toHaveProperty('maxZoom', 16);
    const points = fit.bounds.points;
    expect(points.every(([lng, lat]) => lng === TARGET.longitude && lat === TARGET.latitude)).toBe(true);
  });

  it('does not render the alignment overlay when alignment is absent', () => {
    render(<WorkspaceMap {...PROPS} />);
    loadMap();

    expect(MockMap.instances[0].sources['object-line']).toBeUndefined();
    expect(MockMap.instances[0].sources['tolerance-sector']).toBeUndefined();
    expect(findMarkerByLabel('Sun direction')).toBeUndefined();
    expect(screen.queryByTestId('alignment-status')).toBeNull();
  });

  it('draws the tolerance sector when alignment is present without a sun ray', () => {
    render(<WorkspaceMap {...PROPS} alignment={ALIGNMENT} />);
    loadMap();

    expect(MockMap.instances[0].sources['object-line']).toBeUndefined();
    expect(MockMap.instances[0].sources['tolerance-sector']).toBeTruthy();
    expect(MockMap.instances[0].layers).toContain('tolerance-sector-fill');
    expect(findMarkerByLabel('Sun direction')).toBeUndefined();
  });

  it('combines the alignment sector with the sun ray when both are present', () => {
    render(<WorkspaceMap {...PROPS} alignment={ALIGNMENT} sun={{ object: 'Sun', azimuth: 80.12 }} />);
    loadMap();

    const endpoint = sunEndpoint(80.12);
    const objectLine = MockMap.instances[0].sources['object-line'];
    expect(lineCoordinates(objectLine)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);
    expect(MockMap.instances[0].sources['tolerance-sector']).toBeTruthy();
    expect(MockMap.instances[0].layers).toContain('object-line');
    expect(MockMap.instances[0].layers).toContain('tolerance-sector-fill');
  });

  it('places a sun direction marker with the correct symbol and popup', () => {
    render(<WorkspaceMap {...PROPS} sun={{ object: 'Moon', azimuth: 80.12 }} />);
    loadMap();

    const marker = findMarkerByLabel('Moon direction');
    const element = marker?.options.element as HTMLElement;
    expect(element?.textContent).toBe('🌙');
    expect(marker?.options.anchor).toBe('bottom');
    expect(marker?.popup?.content?.textContent).toContain('Moon azimuth direction');
    expect(marker?.popup?.content?.textContent).toContain('Azimuth: 80.12°');
  });

  it('shows the alignment status overlay from the alignment values', () => {
    render(<WorkspaceMap {...PROPS} alignment={{ ...ALIGNMENT, angularSeparation: 0.04, withinTolerance: true }} />);
    loadMap();

    const overlay = document.querySelector('[data-testid="alignment-status"]');
    expect(overlay?.textContent).toContain('Target bearing');
    expect(overlay?.textContent).toContain('78.96°');
    expect(overlay?.textContent).toContain('Sun azimuth');
    expect(overlay?.textContent).toContain('80.12°');
    expect(overlay?.textContent).toContain('0.04°');
    expect(overlay?.textContent).toContain('✓ Within 0.5° tolerance');
  });

  it('plots the sun direction ray and marker anchored at the computed endpoint', () => {
    render(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 45 }} />);
    loadMap();

    const endpoint = sunEndpoint(45);
    const objectLine = MockMap.instances[0].sources['object-line'];
    expect(lineCoordinates(objectLine)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);

    const marker = findMarkerByLabel('Sun direction');
    expect(marker?.lngLat).toEqual({ lng: endpoint.longitude, lat: endpoint.latitude });
    expect(marker?.options.anchor).toBe('bottom');
    const element = marker?.options.element as HTMLElement;
    expect(element?.textContent).toBe('☀');
    expect(marker?.popup?.content?.textContent).toContain('Sun azimuth direction');
    expect(marker?.popup?.content?.textContent).toContain('Azimuth: 45.00°');
  });

  it('updates the sun marker and popup when the sun azimuth changes', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 45 }} />);
    loadMap();

    const endpoint = sunEndpoint(110);
    rerender(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 110 }} />);

    const marker = findMarkerByLabel('Sun direction');
    expect(marker?.lngLat).toEqual({ lng: endpoint.longitude, lat: endpoint.latitude });
    expect(marker?.popup?.content?.textContent).toContain('Azimuth: 110.00°');
  });

  it('does not change the viewport when the sun position changes', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 45 }} />);
    loadMap();

    const fitsBefore = MockMap.instances[0].fitCalls.length;
    rerender(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 110 }} />);

    expect(MockMap.instances[0].fitCalls.length).toBe(fitsBefore);
  });

  it('removes the sun ray and marker when the sun prop becomes null', () => {
    const { rerender } = render(<WorkspaceMap {...PROPS} sun={{ object: 'Sun', azimuth: 45 }} />);
    loadMap();

    expect(findMarkerByLabel('Sun direction')).toBeTruthy();
    expect(MockMap.instances[0].sources['object-line']).toBeTruthy();

    rerender(<WorkspaceMap {...PROPS} sun={null} />);

    expect(findMarkerByLabel('Sun direction')).toBeUndefined();
    expect(MockMap.instances[0].sources['object-line']).toBeUndefined();
  });

  it('draws the sun ray when sun is provided at load time', () => {
    render(<WorkspaceMap {...PROPS} sun={{ object: 'Moon', azimuth: 200 }} />);
    loadMap();

    const endpoint = sunEndpoint(200);
    const objectLine = MockMap.instances[0].sources['object-line'];
    expect(lineCoordinates(objectLine)).toEqual([
      [OBSERVER.longitude, OBSERVER.latitude],
      [endpoint.longitude, endpoint.latitude]
    ]);
    expect((findMarkerByLabel('Moon direction')?.options.element as HTMLElement)?.textContent).toBe('🌙');
  });

  it('shows a graceful fallback when the map cannot be created', () => {
    MockMap.shouldThrow = true;
    render(<WorkspaceMap {...PROPS} />);

    expect(screen.getByTestId('workspace-map-unavailable').textContent).toContain('Map unavailable');
    expect(MockMap.instances).toHaveLength(0);
  });
});
