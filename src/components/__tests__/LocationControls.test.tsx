import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LocationControls from '../LocationControls';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

const OBSERVER_PLACEHOLDER = 'Search for an address, postal code or place...';
const TARGET_PLACEHOLDER = 'Search for a landmark or address...';

function Harness({
  onInputErrorChange
}: {
  onInputErrorChange?: (_hasError: boolean) => void;
} = {}) {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [observerLandmark, setObserverLandmark] = useState<SelectedLandmark | null>(null);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);

  return (
    <SavedLocationsProvider>
      <LocationControls
        observer={observer}
        target={target}
        observerLandmark={observerLandmark}
        landmark={landmark}
        timeZone="Asia/Singapore"
        timeZoneStatus="idle"
        onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
        onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
        onSelectObserverLandmark={(selected) => {
          setObserverLandmark(selected);
          setObserver((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
        }}
        onSelectLandmark={(selected) => {
          setLandmark(selected);
          setTarget((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
        }}
        onClearObserverLandmark={() => setObserverLandmark(null)}
        onClearLandmark={() => setLandmark(null)}
        onInputErrorChange={onInputErrorChange}
      />
    </SavedLocationsProvider>
  );
}

function editObserverButton() {
  return screen.getByRole('button', { name: /edit observer location/i });
}

function displayValue(value: number) {
  return String(Number(value.toFixed(10)));
}

function editTargetButton() {
  return screen.getByRole('button', { name: /edit target location/i });
}

function saveObserverButton() {
  return screen.getByRole('button', { name: /save observer location/i });
}

function startEditingObserver() {
  fireEvent.click(editObserverButton());
}

function startEditingTarget() {
  fireEvent.click(editTargetButton());
}

function changeLatitude(index: number, value: string) {
  fireEvent.change(screen.getAllByLabelText('Latitude')[index], { target: { value } });
}

async function selectSearchResult(placeholder: string, resultName: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: resultName } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  fireEvent.mouseDown(screen.getByText(resultName));
}

describe('LocationControls', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a Save target button under the target panel and saves the target', async () => {
    render(<Harness />);

    expect(screen.getByTestId('save-target-button')).toBeTruthy();
    fireEvent.click(screen.getByTestId('save-target-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-target-button')).toBeTruthy();
    });
    expect(screen.getByTestId('saved-target-button').textContent).toMatch(/Target 1\.315079,103\.892121/);
  });

  it('renders observer save controls and saves the observer as a shooting location', async () => {
    render(<Harness />);

    expect(screen.getByTestId('save-shooting-location-button')).toBeTruthy();
    expect(screen.getByTestId('save-setup-button')).toBeTruthy();

    fireEvent.click(screen.getByTestId('save-shooting-location-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-shooting-location-button').textContent).toMatch(/Single point/);
    });
  });

  it('saves a setup combining the target and observer location', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId('save-setup-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-setup-button').textContent).toMatch(/Setup saved ✓/);
    });
  });

  it('renders the Location heading, plain-text coordinate panels, timezone chip, and both search bars', () => {
    render(<Harness />);

    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Observer location')).toBeTruthy();
    expect(screen.getByText('Target location')).toBeTruthy();
    expect(screen.queryByLabelText('Latitude')).toBeNull();
    expect(screen.queryByLabelText('Longitude')).toBeNull();
    expect(screen.queryByLabelText('Elevation (m)')).toBeNull();
    expect(screen.getByText(displayValue(DEFAULT_OBSERVER.latitude))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_OBSERVER.longitude))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_TARGET.latitude))).toBeTruthy();
    expect(screen.getAllByText('0 m')).toHaveLength(2);
    expect(screen.getByText(/Asia\/Singapore/)).toBeTruthy();
    expect(screen.getByPlaceholderText(OBSERVER_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByPlaceholderText(TARGET_PLACEHOLDER)).toBeTruthy();
  });

  it('shows exactly one edit button per location and no per-field edit buttons', () => {
    render(<Harness />);

    expect(editObserverButton()).toBeTruthy();
    expect(editTargetButton()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit latitude/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit longitude/i })).toBeNull();
  });

  it('lays out the two location panels in a two-column grid on desktop', () => {
    render(<Harness />);

    const grid = screen.getByText('Observer location').closest('.grid') as HTMLElement;
    expect(grid.className).toContain('grid');
    expect(grid.className).toContain('md:grid-cols-2');
  });

  it('edits observer and target coordinates independently via the pencil button and Enter', () => {
    render(<Harness />);

    startEditingObserver();
    expect(screen.getByRole('button', { name: /save observer location/i })).toBeTruthy();
    changeLatitude(0, '1.5');
    fireEvent.keyDown(screen.getAllByLabelText('Latitude')[0], { key: 'Enter' });

    expect(screen.queryByRole('button', { name: /save observer location/i })).toBeNull();
    expect(screen.getAllByText('1.5')).toHaveLength(1);

    startEditingTarget();
    changeLatitude(0, '2.5');
    fireEvent.keyDown(screen.getAllByLabelText('Latitude')[0], { key: 'Enter' });

    expect(screen.getAllByText('2.5')).toHaveLength(1);

    startEditingObserver();
    fireEvent.change(screen.getAllByLabelText('Longitude')[0], { target: { value: '104.2' } });
    fireEvent.keyDown(screen.getAllByLabelText('Longitude')[0], { key: 'Enter' });
    expect(screen.getAllByText('104.2')).toHaveLength(1);

    startEditingObserver();
    fireEvent.change(screen.getAllByLabelText('Elevation (m)')[0], { target: { value: '50' } });
    fireEvent.keyDown(screen.getAllByLabelText('Elevation (m)')[0], { key: 'Enter' });
    expect(screen.getAllByText('50 m')).toHaveLength(1);
  });

  it('enters edit mode with a double-click on a value and commits with the save button', () => {
    render(<Harness />);

    const latitudeValue = screen.getByText(displayValue(DEFAULT_OBSERVER.latitude));
    fireEvent.doubleClick(latitudeValue);

    expect(saveObserverButton()).toBeTruthy();

    changeLatitude(0, '2.5');
    fireEvent.click(saveObserverButton());

    expect(screen.queryByRole('button', { name: /save observer location/i })).toBeNull();
    expect(screen.getAllByText('2.5')).toHaveLength(1);
  });

  it('cancels an edit with Escape and restores the previous value', () => {
    render(<Harness />);

    startEditingObserver();
    changeLatitude(0, '9.9');
    expect((screen.getAllByLabelText('Latitude')[0] as HTMLInputElement).value).toBe('9.9');

    fireEvent.keyDown(screen.getAllByLabelText('Latitude')[0], { key: 'Escape' });

    expect(screen.queryByRole('button', { name: /save observer location/i })).toBeNull();
    expect(screen.getAllByText(displayValue(DEFAULT_OBSERVER.latitude))).toHaveLength(1);
  });

  it('shows an inline error for invalid coordinates without committing them', () => {
    const onInputErrorChange = vi.fn();
    render(<Harness onInputErrorChange={onInputErrorChange} />);

    startEditingObserver();
    changeLatitude(0, '200');

    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();
    expect(onInputErrorChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Enter valid coordinates to continue.')).toBeTruthy();
    expect(saveObserverButton()).toBeTruthy();
  });

  it('blocks an invalid commit and commits once the value is corrected', () => {
    render(<Harness />);

    startEditingObserver();
    changeLatitude(0, '200');
    fireEvent.click(saveObserverButton());

    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();
    expect(saveObserverButton()).toBeTruthy();

    changeLatitude(0, '1.5');
    fireEvent.click(saveObserverButton());

    expect(screen.queryByRole('button', { name: /save observer location/i })).toBeNull();
    expect(screen.getAllByText('1.5')).toHaveLength(1);
  });

  it('reports errors on the target latitude as well', () => {
    const onInputErrorChange = vi.fn();
    render(<Harness onInputErrorChange={onInputErrorChange} />);

    startEditingTarget();
    changeLatitude(0, '-100');

    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();
    expect(onInputErrorChange).toHaveBeenLastCalledWith(true);
  });

  it('selects an observer search result and updates only the observer', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      {
        id: 'sp',
        name: 'Singapore Polytechnic',
        formattedAddress: '500 Dover Road, Singapore 139651',
        latitude: 1.3099,
        longitude: 103.7781
      }
    ]);
    render(<Harness />);

    await selectSearchResult(OBSERVER_PLACEHOLDER, 'Singapore Polytechnic');

    expect(screen.getByText('Singapore Polytechnic')).toBeTruthy();
    expect(screen.getByText(displayValue(1.3099))).toBeTruthy();
    expect(screen.getByText(displayValue(103.7781))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_TARGET.latitude))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_TARGET.longitude))).toBeTruthy();
    expect(screen.getByText('500 Dover Road, Singapore 139651')).toBeTruthy();
    vi.useRealTimers();
  });

  it('selects a target search result and updates only the target', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      {
        id: 'mbs',
        name: 'Marina Bay Sands',
        formattedAddress: '10 Bayfront Avenue, Singapore 018956',
        latitude: 1.2834,
        longitude: 103.8607
      }
    ]);
    render(<Harness />);

    await selectSearchResult(TARGET_PLACEHOLDER, 'Marina Bay Sands');

    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    expect(screen.getByText(displayValue(1.2834))).toBeTruthy();
    expect(screen.getByText(displayValue(103.8607))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_OBSERVER.latitude))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_OBSERVER.longitude))).toBeTruthy();
    expect(screen.getByText('10 Bayfront Avenue, Singapore 018956')).toBeTruthy();
    vi.useRealTimers();
  });

  it('a failed target search does not overwrite existing coordinates', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([]);
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText(TARGET_PLACEHOLDER), { target: { value: 'Nowhereville' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/no locations found/i)).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_TARGET.latitude))).toBeTruthy();
    expect(screen.getByText(displayValue(DEFAULT_TARGET.longitude))).toBeTruthy();
    vi.useRealTimers();
  });

  it('selects a landmark and reflects it in the summary and target coordinates', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      {
        id: 'mbs',
        name: 'Marina Bay Sands',
        locality: 'Singapore',
        country: 'Singapore',
        latitude: 1.2834,
        longitude: 103.8607
      }
    ]);
    render(<Harness />);

    await selectSearchResult(TARGET_PLACEHOLDER, 'Marina Bay Sands');

    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    expect(screen.getAllByText('1.2834')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('clears a selected landmark', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      {
        id: 'mbs',
        name: 'Marina Bay Sands',
        locality: 'Singapore',
        country: 'Singapore',
        latitude: 1.2834,
        longitude: 103.8607
      }
    ]);
    render(<Harness />);

    await selectSearchResult(TARGET_PLACEHOLDER, 'Marina Bay Sands');
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Clear landmark'));

    expect(screen.queryByText('Marina Bay Sands')).toBeNull();
    vi.useRealTimers();
  });

  it('clears a selected observer landmark', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      {
        id: 'sp',
        name: 'Singapore Polytechnic',
        formattedAddress: '500 Dover Road, Singapore 139651',
        latitude: 1.3099,
        longitude: 103.7781
      }
    ]);
    render(<Harness />);

    await selectSearchResult(OBSERVER_PLACEHOLDER, 'Singapore Polytechnic');
    expect(screen.getByText('Singapore Polytechnic')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Clear observer landmark'));

    expect(screen.queryByText('Singapore Polytechnic')).toBeNull();
    vi.useRealTimers();
  });
});
