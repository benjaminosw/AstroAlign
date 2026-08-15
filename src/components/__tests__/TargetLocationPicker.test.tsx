import { expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import TargetLocationPicker from '../TargetLocationPicker';
import { DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../TargetSelectionMap', () => ({
  __esModule: true,
  default: ({ latitude, longitude, onMove }: { latitude: number; longitude: number; onMove: (_lat: number, _lon: number) => void }) => (
    <div data-testid="target-map-mock">
      <span data-testid="target-map-coords">
        {latitude},{longitude}
      </span>
      <button data-testid="simulate-map-click" onClick={() => onMove(1.42, 103.92)}>
        click map
      </button>
      <button data-testid="simulate-marker-drag" onClick={() => onMove(1.55, 104.01)}>
        drag marker
      </button>
    </div>
  )
}));

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

const MBS: SelectedLandmark = {
  id: 'mbs',
  name: 'Marina Bay Sands',
  locality: 'Singapore',
  country: 'Singapore',
  latitude: 1.2834,
  longitude: 103.8607
};

function Harness() {
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);

  return (
    <TargetLocationPicker
      idPrefix="target"
      target={target}
      landmark={landmark}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
      onSelectLandmark={(selected) => {
        setLandmark(selected);
        setTarget((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
      }}
      onClearLandmark={() => setLandmark(null)}
    />
  );
}

function latitudeInput() {
  return screen.getByLabelText('Latitude') as HTMLInputElement;
}

function longitudeInput() {
  return screen.getByLabelText('Longitude') as HTMLInputElement;
}

async function selectLandmark(query = 'Marina Bay Sands') {
  fireEvent.change(screen.getByPlaceholderText('Search for a landmark...'), { target: { value: query } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));
}

async function openMap(label = /select target on map/i) {
  fireEvent.click(screen.getByRole('button', { name: label }));
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

  it('populates latitude and longitude when a landmark is selected and keeps the name as metadata', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<Harness />);

    await selectLandmark();

    expect(latitudeInput().value).toBe('1.2834');
    expect(longitudeInput().value).toBe('103.8607');
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    expect(screen.getByText('Singapore, Singapore')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adjust on map' })).toBeTruthy();
  });

  it('keeps the landmark when coordinates are edited manually and shows an adjustment indicator', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<Harness />);

    await selectLandmark();
    fireEvent.change(latitudeInput(), { target: { value: '1.5' } });

    expect(screen.getByText('Coordinates manually adjusted')).toBeTruthy();
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    expect(longitudeInput().value).toBe('103.8607');
  });

  it('clearing the landmark does not erase the manually set coordinates', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<Harness />);

    await selectLandmark();
    fireEvent.change(latitudeInput(), { target: { value: '1.6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear landmark' }));

    expect(screen.queryByText('Marina Bay Sands')).toBeNull();
    expect(latitudeInput().value).toBe('1.6');
    expect(longitudeInput().value).toBe('103.8607');
    expect(screen.getByPlaceholderText('Search for a landmark...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select target on map' })).toBeTruthy();
  });

  it('syncing landmark -> coordinates -> map keeps all three in agreement', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<Harness />);

    await openMap();
    const mapCoordsBefore = screen.getByTestId('target-map-coords').textContent;
    expect(mapCoordsBefore).toBe(`${DEFAULT_TARGET.latitude},${DEFAULT_TARGET.longitude}`);

    await selectLandmark();

    expect(latitudeInput().value).toBe('1.2834');
    expect(longitudeInput().value).toBe('103.8607');
    expect(screen.getByTestId('target-map-coords').textContent).toBe('1.2834,103.8607');
  });

  it('clicking the map updates the target coordinates', async () => {
    render(<Harness />);

    await openMap();
    fireEvent.click(screen.getByTestId('simulate-map-click'));

    expect(latitudeInput().value).toBe('1.42');
    expect(longitudeInput().value).toBe('103.92');
    expect(screen.getByTestId('target-map-coords').textContent).toBe('1.42,103.92');
  });

  it('dragging the marker updates the target coordinates', async () => {
    render(<Harness />);

    await openMap();
    fireEvent.click(screen.getByTestId('simulate-marker-drag'));

    expect(latitudeInput().value).toBe('1.55');
    expect(longitudeInput().value).toBe('104.01');
    expect(screen.getByTestId('target-map-coords').textContent).toBe('1.55,104.01');
  });

  it('manual coordinate edits stay synchronised with the map', async () => {
    render(<Harness />);

    await openMap();
    fireEvent.change(latitudeInput(), { target: { value: '2.2' } });

    expect(screen.getByTestId('target-map-coords').textContent).toBe('2.2,103.89212097301142');
  });

  it('manual coordinate targeting works without ever selecting a landmark', () => {
    render(<Harness />);

    fireEvent.change(latitudeInput(), { target: { value: '3.3' } });
    fireEvent.change(longitudeInput(), { target: { value: '101.5' } });

    expect(latitudeInput().value).toBe('3.3');
    expect(longitudeInput().value).toBe('101.5');
    expect(screen.queryByText(/landmarks? found/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Select target on map' })).toBeTruthy();
  });

  it('includes the landmark in the map view when opened after selection', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<Harness />);

    await selectLandmark();
    await openMap(/adjust on map/i);

    const map = screen.getByTestId('target-map-mock');
    expect(within(map).getByTestId('target-map-coords').textContent).toBe('1.2834,103.8607');
  });


