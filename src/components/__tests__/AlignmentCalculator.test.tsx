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

vi.mock('../../lib/astronomy/riseSet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/astronomy/riseSet')>();
  return { ...actual, findRiseSetLocalTimes: vi.fn() };
});

vi.mock('../WorkspaceMap', () => ({
  __esModule: true,
  default: (props: {
    className?: string;
    observer: { latitude: number; longitude: number };
    target: { latitude: number; longitude: number };
    targetName?: string | null;
    activeLocation: string;
    onObserverMove: (_latitude: number, _longitude: number) => void;
    onTargetMove: (_latitude: number, _longitude: number) => void;
    onActivate: (_location: string) => void;
    fitId?: number;
    fitTarget?: 'both' | 'observer' | 'target';
    alignment?: {
      object: string;
      objectAzimuth: number;
      targetBearing: number;
      angularSeparation: number;
      toleranceDegrees: number;
      withinTolerance: boolean;
      azimuthLabel?: string;
    } | null;
    sun?: { object: string; azimuth: number } | null;
  }) => (
    <div
      data-testid="mock-workspace-map"
      className={props.className}
      data-observer-lat={props.observer.latitude}
      data-observer-lon={props.observer.longitude}
      data-target-lat={props.target.latitude}
      data-target-lon={props.target.longitude}
      data-active-location={props.activeLocation}
      data-fit-id={props.fitId ?? 0}
      data-fit-target={props.fitTarget ?? 'both'}
      data-target-name={props.targetName ?? ''}
      data-object={props.alignment?.object ?? ''}
      data-azimuth-label={props.alignment?.azimuthLabel ?? ''}
      data-object-azimuth={props.alignment?.objectAzimuth ?? 0}
      data-target-bearing={props.alignment?.targetBearing ?? 0}
      data-angular-separation={props.alignment?.angularSeparation ?? 0}
      data-tolerance={props.alignment?.toleranceDegrees ?? 0}
      data-within-tolerance={props.alignment?.withinTolerance ?? false}
      data-sun-object={props.sun?.object ?? ''}
      data-sun-azimuth={props.sun?.azimuth ?? 0}
    >
      <button onClick={() => props.onObserverMove(1.5, 104.2)}>simulate-observer-move</button>
      <button onClick={() => props.onTargetMove(2.1, 101.9)}>simulate-target-move</button>
    </div>
  )
}));

import { activeGeocoder } from '../../lib/geocoding/index';
import { calculateAlignment } from '../../lib/alignment/calculateAlignment';
import { findRiseSetLocalTimes } from '../../lib/astronomy/riseSet';

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [observerLandmark, setObserverLandmark] = useState<SelectedLandmark | null>(null);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <AlignmentCalculator
      observer={observer}
      target={target}
      observerLandmark={observerLandmark}
      landmark={landmark}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      observerCoordinateError={observerCoordinateError}
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
  return screen.getByTestId('mock-workspace-map');
}

function mapProp(name: string) {
  return mapElement().getAttribute(name);
}

function editObserverLatitude(value: string) {
  fireEvent.click(screen.getByRole('button', { name: /edit observer location/i }));
  fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value } });
  fireEvent.keyDown(screen.getAllByLabelText('Latitude')[0], { key: 'Enter' });
}

async function waitForMap() {
  return screen.findByTestId('mock-workspace-map', {}, { timeout: 3000 });
}

describe('AlignmentCalculator workspace', () => {
  beforeEach(() => {
    vi.mocked(findRiseSetLocalTimes).mockReset();
  });

  it('starts in needs-calculation state with a bright action button and placeholder results', () => {
    render(<Harness />);

    const button = calculateButton();
    expect(button.className).toContain('bg-sky-500');
    expect(calculatedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();

    expect(screen.queryByLabelText('Latitude')).toBeNull();
    expect(screen.getAllByText('Latitude')).toHaveLength(2);
    expect(screen.getByLabelText('Date')).toBeTruthy();
    expect(screen.queryByTestId('editing-observer')).toBeNull();
    expect(screen.queryByText(/Editing:/)).toBeNull();
  });

  it('shows a compact result after calculation, flips the button, and keeps inputs editable', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());

    expect(calculatedButton()?.className).toContain('bg-slate-700');
    expect(screen.getByText('Alignment result')).toBeTruthy();
    expect(screen.getByText(/☀ Sun · \d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}/)).toBeTruthy();
    expect(screen.getByText(/(within|outside) [\d.]+°/i)).toBeTruthy();
    expect(screen.queryByText('Results will appear here after you calculate.')).toBeNull();
    await waitForMap();

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } });
    expect(dateInput.value).toBe('2026-08-20');
  });

  it('shows detailed diagnostics behind a collapsed Details section', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());

    const details = screen.getByTestId('alignment-details');
    expect(details.hasAttribute('open')).toBe(false);

    expect(screen.getByText('Tolerance')).toBeTruthy();
    expect(screen.getByText('Angular separation')).toBeTruthy();
    expect(screen.getByText('Azimuth difference')).toBeTruthy();
    expect(screen.getByText('Altitude difference')).toBeTruthy();
    expect(screen.getByText('Sun altitude')).toBeTruthy();
    expect(screen.getByText('Target altitude')).toBeTruthy();
    expect(screen.getByText('Target distance')).toBeTruthy();

    fireEvent.click(within(details).getByText('Details'));
    expect(details.hasAttribute('open')).toBe(true);
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
    expect(screen.queryByText(/01\/01\/2030/)).toBeNull();
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
    await recalcThenChange(() => editObserverLatitude('1.5'));
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
    expect(screen.getByText(/01\/01\/2030/)).toBeTruthy();
  });

  it('shows an error and does not mark inputs as calculated when calculation fails', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /edit observer location/i }));
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });
    expect(screen.getAllByText(/latitude must be between/i).length).toBeGreaterThan(0);

    fireEvent.click(calculateButton());

    expect(screen.getByText(/enter valid coordinates to calculate/i)).toBeTruthy();
    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();
  });

  it('stacks location, full-width map, then settings and result side by side below the map', async () => {
    render(<Harness />);
    await waitForMap();

    const workspace = screen.getByTestId('calculator-workspace');
    expect(workspace.className).toContain('space-y-6');

    const sections = Array.from(workspace.children) as HTMLElement[];
    expect(sections.map((el) => el.getAttribute('data-testid'))).toEqual([
      'location-controls',
      'mock-workspace-map',
      'alignment-columns'
    ]);

    expect(sections[1].className).toContain('lg:h-[620px]');
    expect(within(sections[0]).getByText(/Asia\/Singapore/)).toBeTruthy();

    const columns = Array.from(sections[2].children) as HTMLElement[];
    expect(columns.map((el) => el.getAttribute('data-testid'))).toEqual([
      'alignment-settings-card',
      'alignment-result-card'
    ]);
    expect(sections[2].className).toContain('lg:grid-cols-2');
    expect(within(columns[0]).getByText('Alignment settings')).toBeTruthy();
    expect(within(columns[1]).getByText('Alignment result')).toBeTruthy();
  });

  it('passes the live sun azimuth to the map and updates it when the date changes', async () => {
    render(<Harness />);
    const map = await waitForMap();

    await waitFor(() => {
      expect(Number(map.getAttribute('data-sun-azimuth'))).toBeGreaterThan(0);
    });
    expect(map.getAttribute('data-sun-object')).toBe('Sun');
    const azimuthBefore = map.getAttribute('data-sun-azimuth');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });

    await waitFor(() => {
      expect(map.getAttribute('data-sun-azimuth')).not.toBe(azimuthBefore);
    });
    expect(map.getAttribute('data-fit-id')).toBe('0');
  });

  it('marks the calculation as stale when a landmark is selected', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark or address...'), { target: { value: 'Marina Bay Sands' } });
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
    expect(map.getAttribute('data-fit-id')).toBe('0');
    expect(map.getAttribute('data-fit-target')).toBe('target');
  });

  it('does not move the viewport when a marker is dragged after a calculation', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    await waitForMap();
    const fitBefore = mapProp('data-fit-id');

    fireEvent.click(screen.getByText('simulate-observer-move'));

    expect(mapProp('data-observer-lat')).toBe('1.5');
    expect(mapProp('data-observer-lon')).toBe('104.2');
    expect(mapProp('data-fit-id')).toBe(fitBefore);
  });

  it('updates the map markers to live coordinates while keeping the calculated overlay until recalculation', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    await waitForMap();
    const azimuthBefore = mapProp('data-object-azimuth');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    editObserverLatitude('1.5');

    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(mapProp('data-object-azimuth')).toBe(azimuthBefore);
    expect(mapProp('data-observer-lat')).toBe('1.5');
    expect(mapProp('data-fit-id')).toBe('0');
  });

  it('updates both the numerical result and the map on recalculation without moving the viewport', async () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    await waitForMap();
    const azimuthBefore = mapProp('data-object-azimuth');
    const fitBefore = mapProp('data-fit-id');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    fireEvent.click(calculateButton());

    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(screen.getByText(/01\/01\/2030/)).toBeTruthy();
    await waitFor(() => {
      expect(mapProp('data-object-azimuth')).not.toBe(azimuthBefore);
    });
    expect(mapProp('data-fit-id')).toBe(fitBefore);
  });

  it('shows the selected landmark name on the map when calculated from a landmark selection', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark or address...'), { target: { value: 'Marina Bay Sands' } });
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
    expect(mapProp('data-fit-id')).toBe('1');
    vi.useRealTimers();
  });

  it('searching an observer location updates the observer marker and fits the map to it', async () => {
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
    fireEvent.click(calculateButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search for an address, postal code or place...'), {
      target: { value: 'Singapore Polytechnic' }
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Singapore Polytechnic'));

    expect(mapProp('data-observer-lat')).toBe('1.3099');
    expect(mapProp('data-observer-lon')).toBe('103.7781');
    expect(mapProp('data-target-lat')).toBe(String(DEFAULT_TARGET.latitude));
    expect(mapProp('data-fit-target')).toBe('observer');
    expect(mapProp('data-fit-id')).toBe('1');
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

    editObserverLatitude('1.5');
    editObserverLatitude('1.9');
    editObserverLatitude('2.0');
    expect(calculatedButton()).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(calculatedButton()).toBeTruthy();
    expect(mapProp('data-fit-id')).toBe(String(fitBefore));
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

    editObserverLatitude('1.5');
    editObserverLatitude('1.7');

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
    editObserverLatitude('1.5');

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

    editObserverLatitude('1.5');
    fireEvent.click(calculateButton());

    expect(calculatedButton()).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(vi.mocked(calculateAlignment).mock.calls.length).toBe(callsBefore + 1);
    expect(mapProp('data-fit-id')).toBe(String(fitBefore));
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

    editObserverLatitude('1.5');
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

    editObserverLatitude('1.5');

    expect(screen.getByTestId('auto-updating')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByTestId('auto-updating')).toBeNull();
    vi.useRealTimers();
  });

  it('navigates to the previous and next day with the date arrows', () => {
    render(<Harness />);

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-03-01' } });
    expect(dateInput.value).toBe('2026-03-01');

    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    expect(dateInput.value).toBe('2026-02-28');

    fireEvent.click(screen.getByRole('button', { name: /next day/i }));
    expect(dateInput.value).toBe('2026-03-01');

    fireEvent.change(dateInput, { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    expect(dateInput.value).toBe('2025-12-31');

    fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: /next day/i }));
    expect(dateInput.value).toBe('2026-01-01');
  });

  it('alternates the time between the rise and set times of the object', () => {
    vi.mocked(findRiseSetLocalTimes).mockReturnValue({ rise: '07:15', set: '18:45' });
    render(<Harness />);

    const timeButtons = screen.getAllByTitle('Click to type a time');
    const hourButton = () => timeButtons[0];
    const minuteButton = () => timeButtons[1];

    expect(screen.getByRole('button', { name: /use sunrise time/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /use sunrise time/i }));
    expect(hourButton().textContent).toBe('07');
    expect(minuteButton().textContent).toBe('15');
    expect(screen.getByRole('button', { name: /use sunset time/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /use sunset time/i }));
    expect(hourButton().textContent).toBe('18');
    expect(minuteButton().textContent).toBe('45');
    expect(screen.getByRole('button', { name: /use sunrise time/i })).toBeTruthy();

    expect(vi.mocked(findRiseSetLocalTimes)).toHaveBeenCalledTimes(2);
  });

  it('uses the moonrise and moonset labels for the Moon object', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Astronomical object'), { target: { value: 'Moon' } });

    expect(screen.getByRole('button', { name: /use moonrise time/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /use sunrise time/i })).toBeNull();
  });

  it('shows an error when no rise time is found for the date and location', () => {
    vi.mocked(findRiseSetLocalTimes).mockReturnValue({ rise: null, set: '18:45' });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /use sunrise time/i }));

    expect(screen.getByText(/no sunrise time found for this date and location/i)).toBeTruthy();
  });

  it('marks the calculation as stale when the rise or set time is applied', () => {
    vi.mocked(findRiseSetLocalTimes).mockReturnValue({ rise: '07:15', set: '18:45' });
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /use sunrise time/i }));

    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
  });

  it('shows an error and does not change the time when coordinates are invalid', () => {
    vi.mocked(findRiseSetLocalTimes).mockReturnValue({ rise: '07:15', set: '18:45' });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /edit observer location/i }));
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });

    fireEvent.click(screen.getByRole('button', { name: /use sunrise time/i }));

    expect(screen.getByText(/latitude must be between/i)).toBeTruthy();
    expect(vi.mocked(findRiseSetLocalTimes)).not.toHaveBeenCalled();
  });
});
