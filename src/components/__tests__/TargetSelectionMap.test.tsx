import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import TargetSelectionMap from '../TargetSelectionMap';

const { MockMap, MockMarker, MockPopup } = vi.hoisted(() => {
  class MockPopup {
    content: HTMLElement | null = null;
    setDOMContent(node: HTMLElement) {
      this.content = node;
      return this;
    }
  }

  class MockMarker {
    static instances: MockMarker[] = [];
    handlers: Record<string, (_event?: unknown) => void> = {};
    popup: MockPopup | null = null;
    lngLat: { lat: number; lng: number } | null = null;

    constructor(_options: Record<string, unknown>) {
      MockMarker.instances.push(this);
    }

    setLngLat(lngLat: { lat: number; lng: number } | [number, number]) {
      if (Array.isArray(lngLat)) {
        this.lngLat = { lng: lngLat[0], lat: lngLat[1] };
      } else {
        this.lngLat = lngLat;
      }
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

    on(event: string, callback: (_event?: unknown) => void) {
      this.handlers[event] = callback;
      return this;
    }

    addTo() {
      return this;
    }
  }

  class MockMap {
    static instances: MockMap[] = [];
    handlers: Record<string, (_event?: unknown) => void> = {};
    flyToCalls: Array<{ center: [number, number]; zoom: number }> = [];

    constructor(_options: Record<string, unknown>) {
      MockMap.instances.push(this);
    }

    on(event: string, callback: (_event?: unknown) => void) {
      this.handlers[event] = callback;
      return this;
    }

    addControl() {
      return this;
    }

    isStyleLoaded() {
      return true;
    }

    flyTo(options: { center: [number, number]; zoom: number }) {
      this.flyToCalls.push(options);
      return this;
    }

    remove() {}
  }

  return { MockMap, MockMarker, MockPopup };
});

vi.mock('maplibre-gl', () => {
  return {
    __esModule: true,
    default: {
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
      NavigationControl: class {}
    },
    MockMap,
    MockMarker,
    MockPopup
  };
});

beforeEach(() => {
  MockMap.instances = [];
  MockMarker.instances = [];
});

function loadMap() {
  act(() => {
    (MockMap.instances[0]?.handlers as Record<string, (_event?: unknown) => void>)?.load?.();
  });
}

describe('TargetSelectionMap', () => {
  it('clicking the map moves the target', () => {
    const onMove = vi.fn();
    render(<TargetSelectionMap latitude={1.3} longitude={103.8} onMove={onMove} />);
    loadMap();

    act(() => {
      MockMap.instances[0].handlers.click?.({ lngLat: { lat: 1.4, lng: 103.9 } });
    });

    expect(onMove).toHaveBeenCalledWith(1.4, 103.9);
    expect(MockMarker.instances[0].lngLat).toEqual({ lat: 1.4, lng: 103.9 });
  });

  it('dragging the marker moves the target', () => {
    const onMove = vi.fn();
    render(<TargetSelectionMap latitude={1.3} longitude={103.8} onMove={onMove} />);
    loadMap();

    const marker = MockMarker.instances[0];
    marker.lngLat = { lat: 1.55, lng: 104.01 };
    act(() => {
      marker.handlers.dragend?.();
    });

    expect(onMove).toHaveBeenCalledWith(1.55, 104.01);
  });

  it('keeps the marker in sync when coordinates change from elsewhere', () => {
    const onMove = vi.fn();
    const { rerender } = render(<TargetSelectionMap latitude={1.3} longitude={103.8} onMove={onMove} />);
    loadMap();

    rerender(<TargetSelectionMap latitude={1.9} longitude={103.1} onMove={onMove} />);

    expect(MockMarker.instances[0].lngLat).toEqual({ lat: 1.9, lng: 103.1 });
  });

  it('shows the landmark name and coordinates in the marker popup', () => {
    const onMove = vi.fn();
    render(<TargetSelectionMap latitude={1.2834} longitude={103.8607} landmarkName="Marina Bay Sands" onMove={onMove} />);
    loadMap();

    const popup = MockMarker.instances[0].getPopup() as InstanceType<typeof MockPopup>;
    expect(popup.content?.textContent).toContain('Marina Bay Sands');
    expect(popup.content?.textContent).toContain('Latitude: 1.283400');
    expect(popup.content?.textContent).toContain('Longitude: 103.860700');
  });

  it('flies to the target when flyToId changes', () => {
    const onMove = vi.fn();
    const { rerender } = render(<TargetSelectionMap latitude={1.3} longitude={103.8} onMove={onMove} flyToId={0} />);
    loadMap();

    rerender(<TargetSelectionMap latitude={1.2834} longitude={103.8607} onMove={onMove} flyToId={1} />);

    expect(MockMap.instances[0].flyToCalls.length).toBeGreaterThan(0);
    expect(MockMap.instances[0].flyToCalls.at(-1)?.center).toEqual([103.8607, 1.2834]);
  });
});
