import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LocationEditor from '../LocationEditor';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../LocationMap', () => ({
  __esModule: true,
  default: (props: {
    observer: { latitude: number; longitude: number };
    target: { latitude: number; longitude: number };
    observerName?: string | null;
    targetName?: string | null;
    activeLocation: string;
    onObserverMove: (_latitude: number, _longitude: number) => void;
    onTargetMove: (_latitude: number, _longitude: number) => void;
    onActivate: (_location: string) => void;
    fitId?: number;
  }) => (
    <div
      data-testid="mock-location-map"
      data-observer-lat={props.observer.latitude}
      data-observer-lon={props.observer.longitude}
      data-target-lat={props.target.latitude}
      data-target-lon={props.target.longitude}
      data-active-location={props.activeLocation}
      data-target-name={props.targetName ?? ''}
      data-fit-id={props.fitId ?? 0}
    >
      <button onClick={() => props.onObserverMove(1.5, 104.2)}>simulate-observer-move</button>
      <button onClick={() => props.onTargetMove(2.1, 101.9)}>simulate-target-move</button>
      <button onClick={() => props.onActivate('target')}>simulate-interact</button>
    </div>
  )
}));

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

function Harness({ onInputErrorChange }: { onInputErrorChange?: (_hasError: boolean) => void } = {}) {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);

  return (
    <LocationEditor
      observer={observer}
      target={target}
      landmark={landmark}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
      onSelectLandmark={(selected) => {
        setLandmark(selected);
        setTarget((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
      }}
      onClearLandmark={() => setLandmark(null)}
      onInputErrorChange={onInputErrorChange}
    />
  );
}

async function waitForMap() {
  return screen.findByTestId('mock-location-map', {}, { timeout: 3000 });
}

function mapAttribute(name: string) {
  return screen.getByTestId('mock-location-map').getAttribute(name);
}

function valueOf(input: HTMLElement) {
  return (input as HTMLInputElement).value;
}

describe('LocationEditor', () => {
  it('renders the map, segmented control, and coordinate fields for both locations', async () => {
    render(<Harness />);
    const map = await waitForMap();

    expect(map.getAttribute('data-active-location')).toBe('observer');
    expect(screen.getByTestId('editing-observer').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('editing-target').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByLabelText('Latitude')).toHaveLength(2);
    expect(screen.getAllByLabelText('Longitude')).toHaveLength(2);
    expect(screen.getByTestId('selected-location-info').textContent).toContain('Editing: Observer');
    expect(screen.getByTestId('location-hint')).toBeTruthy();
  });

  it('switches the selected location and moves the target via the map', async () => {
    render(<Harness />);
    await waitForMap();

    fireEvent.click(screen.getByTestId('editing-target'));
    expect(screen.getByTestId('editing-target').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('editing-observer').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('selected-location-info').textContent).toContain('Editing: Target');

    fireEvent.click(screen.getByText('simulate-target-move'));

    expect(valueOf(screen.getAllByLabelText('Latitude')[1])).toBe('2.1');
    expect(valueOf(screen.getAllByLabelText('Longitude')[1])).toBe('101.9');
    expect(mapAttribute('data-target-lat')).toBe('2.1');
    expect(screen.queryByTestId('location-hint')).toBeNull();
  });

  it('moves the observer via the map and syncs the fields, info panel, and map', async () => {
    render(<Harness />);
    await waitForMap();

    fireEvent.click(screen.getByText('simulate-observer-move'));

    expect(valueOf(screen.getAllByLabelText('Latitude')[0])).toBe('1.5');
    expect(valueOf(screen.getAllByLabelText('Longitude')[0])).toBe('104.2');
    expect(mapAttribute('data-observer-lat')).toBe('1.5');
    expect(screen.getByTestId('selected-location-info').textContent).toContain('1.500000, 104.200000');
    expect(screen.queryByTestId('location-hint')).toBeNull();
  });

  it('activates a location when the map marker interaction is reported', async () => {
    render(<Harness />);
    await waitForMap();

    fireEvent.click(screen.getByText('simulate-interact'));

    expect(screen.getByTestId('editing-target').getAttribute('aria-pressed')).toBe('true');
    expect(mapAttribute('data-active-location')).toBe('target');
  });

  it('shows an inline error for invalid coordinates without committing them', async () => {
    const onInputErrorChange = vi.fn();
    render(<Harness onInputErrorChange={onInputErrorChange} />);
    await waitForMap();

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });

    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();
    expect(valueOf(screen.getAllByLabelText('Latitude')[0])).toBe('200');
    expect(mapAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(onInputErrorChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Enter valid coordinates to continue.')).toBeTruthy();
  });

  it('clears the inline error on blur and restores the previous value', async () => {
    render(<Harness />);
    await waitForMap();

    const observerLatitude = screen.getAllByLabelText('Latitude')[0];
    fireEvent.change(observerLatitude, { target: { value: '200' } });
    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();

    fireEvent.blur(observerLatitude);

    expect(screen.queryByText(/latitude must be between/i)).toBeNull();
    expect(valueOf(observerLatitude)).toBe(String(DEFAULT_OBSERVER.latitude));
  });

  it('selects a landmark and reflects it in the chip, fields, and map', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark...'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    expect(valueOf(screen.getAllByLabelText('Latitude')[1])).toBe('1.2834');
    expect(mapAttribute('data-target-lat')).toBe('1.2834');
    expect(mapAttribute('data-target-name')).toBe('Marina Bay Sands');
    vi.useRealTimers();
  });

  it('increments the fit id when the locations change', async () => {
    render(<Harness />);
    await waitForMap();
    expect(mapAttribute('data-fit-id')).toBe('0');

    fireEvent.click(screen.getByText('simulate-observer-move'));

    await waitFor(() => {
      expect(mapAttribute('data-fit-id')).toBe('1');
    });
  });

  it('renders the provided actions below the fields', () => {
    render(
      <LocationEditor
        observer={DEFAULT_OBSERVER}
        target={DEFAULT_TARGET}
        timeZone="Asia/Singapore"
        timeZoneStatus="idle"
        onObserverChange={() => {}}
        onTargetChange={() => {}}
        actions={<button type="button">Custom action</button>}
      />
    );

    expect(screen.getByText('Custom action')).toBeTruthy();
  });
});
