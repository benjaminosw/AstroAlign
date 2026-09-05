import { expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ReverseAlignment from '../ReverseAlignment';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';

vi.mock('../ReverseAlignmentMap', () => ({
  __esModule: true,
  default: ({
    target,
    overlay,
    onTargetMove,
    shootingLocation,
    onShootingLocationMove
  }: {
    target: { latitude: number; longitude: number };
    overlay: { objectAzimuth: number; shootingBearing: number; observerDirectionFromTarget: number } | null;
    onTargetMove: (_lat: number, _lon: number) => void;
    shootingLocation: { latitude: number; longitude: number } | null;
    onShootingLocationMove: (_lat: number, _lon: number) => void;
  }) => (
    <div data-testid="reverse-map-mock">
      <span data-testid="reverse-map-coords">
        {target.latitude},{target.longitude}
      </span>
      {overlay && (
        <span data-testid="reverse-map-overlay">
          {overlay.objectAzimuth}|{overlay.shootingBearing}|{overlay.observerDirectionFromTarget}
        </span>
      )}
      {shootingLocation && (
        <span data-testid="reverse-map-shooting-location">
          {shootingLocation.latitude}|{shootingLocation.longitude}|{overlay?.observerDirectionFromTarget}
        </span>
      )}
      <button data-testid="simulate-marker-drag" onClick={() => onTargetMove(1.55, 104.01)}>
        drag marker
      </button>
      <button
        data-testid="simulate-shooting-drag"
        onClick={() => onShootingLocationMove(1.3442815866686566, 103.77101007696956)}
      >
        drag shooting location
      </button>
    </div>
  )
}));

vi.mock('../../lib/alignment/reverseAlignment', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  calculateReverseAlignment: vi.fn()
}));

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { calculateReverseAlignment } from '../../lib/alignment/reverseAlignment';
import type { ReverseAlignmentResult } from '../../lib/alignment/reverseAlignment';
import { destinationPoint } from '../../lib/geometry/destinationPoint';

function makeResult(overrides: Partial<ReverseAlignmentResult> = {}): ReverseAlignmentResult {
  return {
    object: 'Moon',
    eventType: 'rise',
    date: '2026-08-29',
    time: '19:42:18',
    timeZoneLabel: 'Asia/Singapore (GMT+8)',
    utcInstant: '2026-08-29T11:42:18.000Z',
    objectAzimuth: 123.42,
    objectAltitude: 0.1,
    shootingBearing: 123.42,
    observerDirectionFromTarget: 303.42,
    ...overrides
  };
}

function Harness() {
  const [target, setTarget] = useState(DEFAULT_TARGET);

  return (
    <SavedLocationsProvider>
      <ReverseAlignment
        target={target}
        landmark={null}
        targetCoordinateError={null}
        timeZone="Asia/Singapore"
        timeZoneStatus="idle"
        onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
      />
    </SavedLocationsProvider>
  );
}

async function flushDynamicImport() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('renders the compact target location UI and keeps coordinates in sync with the map', async () => {
  render(<Harness />);
  await flushDynamicImport();

  expect(screen.getByText('Location')).toBeTruthy();
  expect(screen.getByPlaceholderText('Search for a landmark...')).toBeTruthy();

  expect(screen.getByTestId('reverse-map-coords').textContent).toBe(
    `${DEFAULT_TARGET.latitude},${DEFAULT_TARGET.longitude}`
  );

  // Coordinates are shown as text until the pencil icon is used.
  expect(screen.queryByLabelText('Latitude')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Target location' }));
  const latitude = screen.getByLabelText('Latitude') as HTMLInputElement;
  fireEvent.change(latitude, { target: { value: '2.2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target location' }));

  expect(screen.getByTestId('reverse-map-coords').textContent).toBe(`2.2,${DEFAULT_TARGET.longitude}`);

  fireEvent.click(screen.getByTestId('simulate-marker-drag'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Target location' }));
  expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('1.55');
});

it('supports double-click editing of a coordinate', async () => {
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.doubleClick(screen.getByTitle('Double-click to edit Latitude'));
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '3.3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target location' }));

  expect(screen.getByTestId('reverse-map-coords').textContent).toBe(`3.3,${DEFAULT_TARGET.longitude}`);
});

it('changes the date with the previous/next day arrows', async () => {
  render(<Harness />);
  await flushDynamicImport();

  const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: '2026-08-29' } });
  expect(dateInput.value).toBe('2026-08-29');

  fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
  expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-08-30');

  fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
  expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-08-28');
});

it('shows only rise/set events for the selected object', () => {
  render(<Harness />);

  const eventSelect = screen.getByLabelText('Event') as HTMLSelectElement;
  expect([...eventSelect.options].map((option) => option.text)).toEqual(['Sunrise', 'Sunset']);

  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
  expect([...eventSelect.options].map((option) => option.text)).toEqual(['Moonrise', 'Moonset']);
});

it('calculates a reverse alignment and shows both bearings plus the map ray direction', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-29' } });
  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
  await advanceAutoCalculation();

  expect(calculateReverseAlignment).toHaveBeenCalledWith({
    object: 'Moon',
    eventType: 'rise',
    date: '2026-08-29',
    timeZone: 'Asia/Singapore',
    target: DEFAULT_TARGET
  });

  expect(screen.getByText('🌙 Moonrise')).toBeTruthy();
  expect(screen.getByTestId('reverse-map-overlay').textContent).toBe('123.42|123.42|303.42');
  expect(screen.getAllByText('303.42°').length).toBeGreaterThan(0);
});

it('does not render a calculate button or an inputs-changed warning', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  expect(screen.queryByTestId('reverse-calculate-button')).toBeNull();

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-29' } });
  await advanceAutoCalculation();

  expect(screen.queryByText(/Inputs changed/i)).toBeNull();
  expect(screen.getByTestId('reverse-map-overlay')).toBeTruthy();
});

it('shows moon phase information for Moon results', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
  await advanceAutoCalculation();

  expect(screen.getByTestId('reverse-moon-phase').textContent).toContain('Moon phase:');
});

it('does not show moon phase for Sun results', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult({ object: 'Sun' }));
  render(<Harness />);
  await flushDynamicImport();

  await advanceAutoCalculation();

  expect(screen.queryByTestId('reverse-moon-phase')).toBeNull();
  expect(screen.getByText('☀ Sunrise')).toBeTruthy();
});

it('shows a clear message when the selected event does not occur on the date', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(null);
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
  await advanceAutoCalculation();

  expect(screen.getByText(/No Moonrise occurs at the target location/i)).toBeTruthy();
  expect(screen.queryByTestId('reverse-map-overlay')).toBeNull();
});

it('explains that the result is a direction, not a unique location', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  expect(screen.getByText(/a direction, not a unique shooting location/i)).toBeTruthy();
});

it('does not show object azimuth in the results or a details dropdown', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  await advanceAutoCalculation();

  expect(screen.getByText('Observer → Target')).toBeTruthy();
  expect(screen.getAllByText('Target → Possible observer').length).toBeGreaterThan(0);
  expect(screen.queryByText('Object azimuth')).toBeNull();
  expect(screen.queryByText('Details')).toBeNull();
});

async function advanceAutoCalculation() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

it('automatically calculates when inputs change without pressing the button', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-29' } });
  await advanceAutoCalculation();

  expect(calculateReverseAlignment).toHaveBeenCalledWith({
    object: 'Sun',
    eventType: 'rise',
    date: '2026-08-29',
    timeZone: 'Asia/Singapore',
    target: DEFAULT_TARGET
  });
  expect(screen.getByTestId('reverse-map-overlay').textContent).toBe('123.42|123.42|303.42');
});

it('shows an updating indicator while recalculating automatically', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-30' } });
  expect(screen.getByTestId('reverse-auto-updating').textContent).toContain('Updating reverse alignment');

  await advanceAutoCalculation();
  expect(screen.queryByTestId('reverse-auto-updating')).toBeNull();
  expect(screen.getByTestId('reverse-map-overlay')).toBeTruthy();
});

it('keeps the previous result and explains when an automatic update finds no event', async () => {
  vi.mocked(calculateReverseAlignment)
    .mockReturnValueOnce(makeResult())
    .mockReturnValue(null);
  render(<Harness />);
  await flushDynamicImport();

  await advanceAutoCalculation();
  expect(screen.getByTestId('reverse-map-overlay')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-30' } });
  await advanceAutoCalculation();

  expect(screen.getByTestId('reverse-auto-error').textContent).toContain('No Sunrise occurs');
  expect(screen.getByText(/Previous result shown below/i)).toBeTruthy();
  expect(screen.getByTestId('reverse-map-overlay')).toBeTruthy();
});

it('shows a shooting-location picker and save controls once a result is available', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();

  expect(screen.queryByTestId('reverse-shooting-location-card')).toBeNull();

  await advanceAutoCalculation();

  expect(screen.getByTestId('reverse-shooting-location-card')).toBeTruthy();
  expect(screen.getByLabelText('Shooting location distance from target')).toBeTruthy();
  expect(screen.getByLabelText('Distance (km)')).toBeTruthy();
  expect(screen.getByTestId('save-shooting-location-button')).toBeTruthy();
  expect(screen.getByTestId('save-setup-button')).toBeTruthy();
  expect(screen.getByTestId('reverse-map-shooting-location').textContent).toContain('303.42');
});

it('hides the shooting-location picker when no event occurs on the date', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(null);
  render(<Harness />);
  await flushDynamicImport();
  await advanceAutoCalculation();

  expect(screen.queryByTestId('reverse-shooting-location-card')).toBeNull();
});

it('updates the shooting-location distance when the map marker is dragged along the path', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();
  await advanceAutoCalculation();

  expect((screen.getByLabelText('Distance (km)') as HTMLInputElement).value).toBe('5');

  fireEvent.click(screen.getByTestId('simulate-shooting-drag'));

  const afterDrag = (screen.getByLabelText('Distance (km)') as HTMLInputElement).value;
  expect(Number(afterDrag)).toBeGreaterThan(11);
  expect(Number(afterDrag)).toBeLessThan(12.5);
  expect(screen.getByTestId('reverse-shooting-coords').textContent).toMatch(/^-?\d+\.\d{6}, -?\d+\.\d{6}$/);
});

it('moves the marker and coordinates when the distance input changes', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();
  await advanceAutoCalculation();

  fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '20' } });

  const markerText = screen.getByTestId('reverse-map-shooting-location').textContent ?? '';
  const [latitude, longitude, bearing] = markerText.split('|');
  expect(bearing).toBe('303.42');
  const expected = destinationPoint(DEFAULT_TARGET.latitude, DEFAULT_TARGET.longitude, 303.42, 20);
  expect(Number(latitude)).toBeCloseTo(expected.latitude, 5);
  expect(Number(longitude)).toBeCloseTo(expected.longitude, 5);
});

it('saves the selected shooting location along the green path', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();
  await advanceAutoCalculation();

  expect(screen.getByTestId('save-shooting-location-button')).toBeTruthy();
  fireEvent.click(screen.getByTestId('save-shooting-location-button'));

  expect(screen.getByTestId('saved-shooting-location-button').textContent).toContain('Saved');
});

it('clamps the distance input to the green path range', async () => {
  vi.mocked(calculateReverseAlignment).mockReturnValue(makeResult());
  render(<Harness />);
  await flushDynamicImport();
  await advanceAutoCalculation();

  const input = screen.getByLabelText('Distance (km)') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '500' } });
  expect(input.value).toBe('100');
});
