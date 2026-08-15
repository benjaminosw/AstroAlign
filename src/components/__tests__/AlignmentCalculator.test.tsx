import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AlignmentCalculator from '../AlignmentCalculator';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

vi.mock('../../lib/alignment/calculateAlignment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/alignment/calculateAlignment')>();
  return { ...actual, calculateAlignment: vi.fn(actual.calculateAlignment) };
});

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
      data-fit-id={props.fitId ?? 0}
    >
      <button onClick={() => props.onObserverMove(1.5, 104.2)}>simulate-observer-move</button>
      <button onClick={() => props.onTargetMove(2.1, 101.9)}>simulate-target-move</button>
    </div>
  )
}));

vi.mock('../AlignmentMap', () => ({
  __esModule: true,
  default: (props: {
    observer: { latitude: number; longitude: number };
    target: { latitude: number; longitude: number };
    object: string;
    objectAzimuth: number;
    targetBearing: number;
    angularSeparation: number;
    toleranceDegrees: number;
    withinTolerance: boolean;
    targetName?: string | null;
    azimuthLabel?: string;
    fitId?: number;
  }) => (
    <div
      data-testid="mock-alignment-map"
      data-object-azimuth={props.objectAzimuth}
      data-target-bearing={props.targetBearing}
      data-object={props.object}
      data-angular-separation={props.angularSeparation}
      data-tolerance={props.toleranceDegrees}
      data-within-tolerance={props.withinTolerance}
      data-observer-lat={props.observer.latitude}
      data-observer-lon={props.observer.longitude}
      data-target-lat={props.target.latitude}
      data-target-lon={props.target.longitude}
      data-target-name={props.targetName ?? ''}
      data-azimuth-label={props.azimuthLabel ?? ''}
      data-fit-id={props.fitId ?? 0}
    />
  )
}));

import { activeGeocoder } from '../../lib/geocoding/index';
import { calculateAlignment } from '../../lib/alignment/calculateAlignment';

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <AlignmentCalculator
      observer={observer}
      target={target}
      landmark={landmark}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      observerCoordinateError={observerCoordinateError}
      onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
      onSelectLandmark={(selected) => {
        setLandmark(selected);
        setTarget((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
      }}
      onClearLandmark={() => setLandmark(null)}
    />
  );
}

function calculateButton() {
  return screen.getByRole('button', { name: /calculate alignment/i });
}

function calculatedButton() {
  return screen.queryByRole('button', { name: /calculated/i });
}

function mapElement() {
  return screen.getByTestId('mock-alignment-map');
}

function mapProp(name: string) {
  return mapElement().getAttribute(name);
}

async function waitForMap() {
  return screen.findByTestId('mock-alignment-map', {}, { timeout: 3000 });
}

describe('AlignmentCalculator workspace', () => {
  it('starts in needs-calculation state with a bright action button and placeholder results', () => {
    render(<Harness />);

    const button = calculateButton();
    expect(button.className).toContain('bg-sky-500');
    expect(calculatedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();

    expect(screen.getAllByLabelText('Latitude')).toHaveLength(2);
    expect(screen.getByLabelText('Date')).toBeTruthy();
  });

  it('shows results beside the inputs, flips the button, and keeps inputs editable after a calculation', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());

    expect(calculatedButton()?.className).toContain('bg-slate-700');
    expect(screen.getByText('Alignment result')).toBeTruthy();
    expect(screen.getByText(/(within|outside) .*° tolerance/i)).toBeTruthy();
    expect(screen.queryByText('Results will appear here after you calculate.')).toBeNull();
    await waitForMap();

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } });
    expect(dateInput.value).toBe('2026-08-20');
  });

  it('marks inputs as changed and shows a stale indicator while keeping the previous result visible', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();
    await waitForMap();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });

    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText('Alignment result')).toBeTruthy();
    expect(screen.queryByText(/1 Jan 2030/)).toBeNull();
  });

  it('marks inputs as changed for object, time, tolerance, and coordinate edits', async () => {
    render(<Harness />);

    async function recalcThenChange(change: () => void) {
      fireEvent.click(screen.getByRole('button', { name: /calculate|calculated/i }));
      await screen.findByRole('button', { name: /calculated/i });
      await waitForMap();
      change();
      expect(calculatedButton()).toBeNull();
      expect(calculateButton()).toBeTruthy();
    }

    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Astronomical object'), { target: { value: 'Moon' } })
    );
    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-16' } })
    );
    await recalcThenChange(() => fireEvent.click(screen.getByLabelText('Increase hour')));
    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Alignment tolerance'), { target: { value: '1' } })
    );
    await recalcThenChange(() =>
      fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } })
    );
  });

  it('updates the result on recalculate and clears the stale indicator', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();
    await waitForMap();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();

    fireEvent.click(calculateButton());

    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(calculatedButton()).toBeTruthy();
    expect(screen.getByText(/1 Jan 2030/)).toBeTruthy();
  });

  it('shows an error and does not mark inputs as calculated when calculation fails', () => {
    render(<Harness />);

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });
    fireEvent.click(calculateButton());

    expect(screen.getAllByText(/latitude must be between/i).length).toBeGreaterThan(0);
    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();
  });

  it('uses a two-column desktop layout with the location editor on the left and results on the right', () => {
    render(<Harness />);

    const workspace = screen.getByTestId('calculator-workspace');
    expect(workspace.className).toContain('lg:grid-cols-[');

    const columns = Array.from(workspace.children) as HTMLElement[];
    expect(columns).toHaveLength(2);
    expect(within(columns[0]).getByText('Location')).toBeTruthy();
    expect(within(columns[0]).getByText('Observer')).toBeTruthy();
    expect(within(columns[0]).getByText('Target')).toBeTruthy();
    expect(columns[0].className).toContain('lg:sticky');
    expect(within(columns[1]).getByText('Alignment')).toBeTruthy();
    expect(within(columns[1]).getByText('Alignment result')).toBeTruthy();
  });

  it('marks the calculation as stale when a landmark is selected', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark...'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    vi.useRealTimers();
  });

  it('renders the map after a calculation using the calculated object, azimuth, and coordinates', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    const map = await waitForMap();

    expect(map.getAttribute('data-object')).toBe('Sun');
    expect(map.getAttribute('data-azimuth-label')).toBe('Sun azimuth');
    expect(Number(map.getAttribute('data-object-azimuth'))).toBeGreaterThan(0);
    expect(Number(map.getAttribute('data-target-bearing'))).toBeGreaterThan(0);
    expect(map.getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(map.getAttribute('data-observer-lon')).toBe(String(DEFAULT_OBSERVER.longitude));
    expect(map.getAttribute('data-target-lat')).toBe(String(DEFAULT_TARGET.latitude));
    expect(map.getAttribute('data-target-lon')).toBe(String(DEFAULT_TARGET.longitude));
    expect(Number(map.getAttribute('data-fit-id'))).toBeGreaterThanOrEqual(1);
  });

  it('does not update the map azimuth when inputs change before recalculation', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    await waitForMap();
    const azimuthBefore = mapProp('data-object-azimuth');
    const observerBefore = mapProp('data-observer-lat');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } });

    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(mapProp('data-object-azimuth')).toBe(azimuthBefore);
    expect(mapProp('data-observer-lat')).toBe(observerBefore);
  });

  it('updates both the numerical result and the map on recalculation', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    await waitForMap();
    const azimuthBefore = mapProp('data-object-azimuth');
    const fitBefore = mapProp('data-fit-id');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    fireEvent.click(calculateButton());

    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(screen.getByText(/1 Jan 2030/)).toBeTruthy();
    await waitFor(() => {
      expect(mapProp('data-object-azimuth')).not.toBe(azimuthBefore);
    });
    expect(Number(mapProp('data-fit-id'))).toBeGreaterThan(Number(fitBefore));
  });

  it('shows the selected landmark name on the map when calculated from a landmark selection', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark...'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mapProp('data-target-name')).toBe('Marina Bay Sands');
    expect(mapProp('data-target-lat')).toBe('1.2834');
    vi.useRealTimers();
  });

  it('auto-recalculates once with the latest location after a debounce when coordinates change', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calculatedButton()).toBeTruthy();
    const fitBefore = Number(mapProp('data-fit-id'));

    const observerLatitude = screen.getAllByLabelText('Latitude')[0];
    fireEvent.change(observerLatitude, { target: { value: '1.5' } });
    fireEvent.change(observerLatitude, { target: { value: '1.9' } });
    fireEvent.change(observerLatitude, { target: { value: '2.0' } });
    expect(calculatedButton()).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(calculatedButton()).toBeTruthy();
    expect(mapProp('data-fit-id')).toBe(String(fitBefore + 1));
    expect(mapProp('data-observer-lat')).toBe('2');
    vi.useRealTimers();
  });

  it('uses only the latest location when coordinates change quickly during auto-recalculation', async () => {
    vi.useFakeTimers();
    vi.mocked(calculateAlignment).mockClear();
    render(<Harness />);

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const observerLatitude = screen.getAllByLabelText('Latitude')[0];
    fireEvent.change(observerLatitude, { target: { value: '1.5' } });
    fireEvent.change(observerLatitude, { target: { value: '1.7' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(vi.mocked(calculateAlignment).mock.calls.length).toBe(2);
    expect(vi.mocked(calculateAlignment).mock.calls[1][0].observer.latitude).toBe(1.7);
    expect(calculatedButton()).toBeTruthy();
    vi.useRealTimers();
  });

  it('does not auto-recalculate until the first manual calculation', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    const callsBefore = vi.mocked(calculateAlignment).mock.calls.length;
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(vi.mocked(calculateAlignment).mock.calls.length).toBe(callsBefore);
    expect(calculatedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();
    vi.useRealTimers();
  });

  it('manual recalculation cancels a pending auto-recalculation', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsBefore = vi.mocked(calculateAlignment).mock.calls.length;
    const fitBefore = Number(mapProp('data-fit-id'));

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } });
    fireEvent.click(calculateButton());

    expect(calculatedButton()).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(vi.mocked(calculateAlignment).mock.calls.length).toBe(callsBefore + 1);
    expect(mapProp('data-fit-id')).toBe(String(fitBefore + 1));
    vi.useRealTimers();
  });

  it('keeps the previous result and shows a failure banner when auto-recalculation fails', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calculatedButton()).toBeTruthy();

    vi.mocked(calculateAlignment).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText(/unable to update alignment/i)).toBeTruthy();
    expect(screen.getByText(/boom/i)).toBeTruthy();
    expect(calculatedButton()).toBeNull();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText('Alignment result')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows an updating indicator while an auto-recalculation is pending', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } });

    expect(screen.getByTestId('auto-updating')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByTestId('auto-updating')).toBeNull();
    vi.useRealTimers();
  });
});
