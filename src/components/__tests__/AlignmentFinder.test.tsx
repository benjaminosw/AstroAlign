import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AlignmentFinder from '../AlignmentFinder';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';
import { isTimeWithinWindow } from '../../lib/alignment/timeFilter';
import { ASTRO_OBJECT } from '../../types/astronomy';
import type { AlignmentCandidate } from '../../lib/alignment/types';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

vi.mock('../../lib/alignment/findAlignments', () => ({
  findAlignments: vi.fn()
}));

import { findAlignments } from '../../lib/alignment/findAlignments';

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

function sunCandidate(
  localDate: string,
  localTime: string,
  utcInstant: string,
  withinTolerance: boolean,
  eventType: 'rise' | 'set' = 'rise'
): AlignmentCandidate {
  return {
    utcInstant,
    eventType,
    eventLabel: eventType === 'rise' ? 'Sunrise' : 'Sunset',
    localDate,
    localTime,
    timeZone: 'Asia/Singapore',
    timeZoneLabel: 'SGT',
    score: 0.5,
    object: { azimuth: 80, altitude: 0 },
    target: { bearing: 79, distanceKm: 10, altitude: 0 },
    alignment: { angularSeparation: 0.5, azimuthDelta: 0.5, altitudeDelta: 0, withinTolerance }
  };
}

function moonCandidate(
  localDate: string,
  localTime: string,
  utcInstant: string,
  phaseName: string,
  withinTolerance: boolean
): AlignmentCandidate {
  const phase = { name: phaseName, emoji: '🌕', phaseAngle: 180, illuminationPercent: 100 };
  return {
    ...sunCandidate(localDate, localTime, utcInstant, withinTolerance),
    moonPhase: phase,
    moonIlluminationPercent: phase.illuminationPercent
  };
}

const SUN_CANDIDATES = [
  sunCandidate('2026-08-15', '06:00:00', '2026-08-14T22:00:00Z', true, 'rise'),
  sunCandidate('2026-08-15', '18:30:00', '2026-08-15T10:30:00Z', true, 'set'),
  sunCandidate('2026-08-16', '06:01:00', '2026-08-15T22:01:00Z', true, 'rise'),
  sunCandidate('2026-08-15', '18:45:00', '2026-08-15T10:45:00Z', false, 'set'),
  sunCandidate('2026-08-16', '06:05:00', '2026-08-15T22:05:00Z', false, 'rise')
];

const MOON_CANDIDATES = [
  moonCandidate('2025-09-20', '19:00:00', '2025-09-20T11:00:00Z', 'Full Moon', true),
  moonCandidate('2025-09-20', '20:30:00', '2025-09-20T12:30:00Z', 'Waxing Gibbous', true),
  moonCandidate('2025-09-21', '05:30:00', '2025-09-20T21:30:00Z', 'Waning Crescent', true),
  moonCandidate('2025-09-21', '23:00:00', '2025-09-21T15:00:00Z', 'New Moon', true),
  moonCandidate('2025-09-20', '12:00:00', '2025-09-20T04:00:00Z', 'Waxing Gibbous', true),
  moonCandidate('2025-09-20', '19:30:00', '2025-09-20T11:30:00Z', 'Full Moon', false)
];

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [observerLandmark, setObserverLandmark] = useState<SelectedLandmark | null>(null);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <SavedLocationsProvider>
      <AlignmentFinder
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
    </SavedLocationsProvider>
  );
}

function findButton() {
  return screen.getByRole('button', { name: /find alignments/i });
}

function searchedButton() {
  return screen.queryByRole('button', { name: /searched/i });
}

function mapElement() {
  return screen.getByTestId('mock-workspace-map');
}

async function waitForMap() {
  return screen.findByTestId('mock-workspace-map', {}, { timeout: 3000 });
}

function editObserverLatitude(value: string) {
  fireEvent.click(screen.getByRole('button', { name: /edit observer location/i }));
  fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value } });
  fireEvent.keyDown(screen.getAllByLabelText('Latitude')[0], { key: 'Enter' });
}

async function waitForResults() {
  return screen.findByTestId('results-count', {}, { timeout: 5000 });
}

function foundCountText() {
  const element = screen.getByTestId('results-count');
  const numbers = element.textContent?.match(/\d+/g) ?? [];
  return Number(numbers[numbers.length - 1]);
}

function resultItems() {
  return screen.getAllByTestId('alignment-result-item');
}

function eventLabelOf(item: HTMLElement) {
  return item.children[1]?.textContent ?? '';
}

describe('AlignmentFinder workspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(findAlignments).mockImplementation(async (input) => {
      const list = input.object === ASTRO_OBJECT.Moon ? MOON_CANDIDATES : SUN_CANDIDATES;
      return [...list];
    });
  });

  it('renders a Save target button in the target location panel', () => {
    render(<Harness />);

    expect(screen.getByTestId('save-target-button')).toBeTruthy();
  });

  it('starts in needs-search state with a bright button and placeholder results', () => {
    render(<Harness />);

    const button = findButton();
    expect(button.className).toContain('bg-emerald-500');
    expect(searchedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
    expect(screen.queryByTestId('alignment-result-item')).toBeNull();
    expect(screen.queryByTestId('editing-observer')).toBeNull();
  });

  it('shows compact results, marks inputs as searched, and auto-selects the first result on the map', async () => {
    render(<Harness />);
    fireEvent.click(findButton());

    await waitForResults();
    expect(foundCountText()).toBeGreaterThanOrEqual(1);
    expect(searchedButton()?.className).toContain('bg-slate-700');
    expect(screen.queryByText(/inputs changed/i)).toBeNull();

    const items = resultItems();
    expect(items).toHaveLength(foundCountText());
    expect(items.filter((item) => item.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(items[0].getAttribute('aria-pressed')).toBe('true');

    const map = await waitForMap();
    expect(map.getAttribute('data-object')).toBe('Sun');
    expect(map.getAttribute('data-azimuth-label')).toBe(`${eventLabelOf(items[0])} azimuth`);
    expect(Number(map.getAttribute('data-object-azimuth'))).toBeGreaterThan(0);
    expect(Number(map.getAttribute('data-target-bearing'))).toBeGreaterThan(0);
    expect(map.getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(map.getAttribute('data-observer-lon')).toBe(String(DEFAULT_OBSERVER.longitude));
    expect(map.getAttribute('data-target-lat')).toBe(String(DEFAULT_TARGET.latitude));
    expect(map.getAttribute('data-target-lon')).toBe(String(DEFAULT_TARGET.longitude));
    expect(map.getAttribute('data-fit-id')).toBe('0');
  });

  it('renders each result row with arrow, event, dd/mm/yyyy date, time, and error', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();

    const items = resultItems();
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      const arrow = item.children[0].textContent;
      const event = item.children[1].textContent ?? '';
      expect(arrow === '↑' || arrow === '↓').toBe(true);
      if (event.toLowerCase().includes('rise')) {
        expect(arrow).toBe('↑');
      } else if (event.toLowerCase().includes('set')) {
        expect(arrow).toBe('↓');
      }
      expect(within(item).getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeTruthy();
      expect(within(item).getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeTruthy();
      expect(within(item).getByText(/^\d+\.\d{2}°/)).toBeTruthy();
    }
  });

  it('marks inputs as changed after a search while keeping the previous results and map visible', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    const map = await waitForMap();
    const azimuthBefore = map.getAttribute('data-object-azimuth');

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });

    expect(searchedButton()).toBeNull();
    expect(findButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(resultItems().length).toBeGreaterThan(0);
    expect(mapElement().getAttribute('data-object-azimuth')).toBe(azimuthBefore);
    expect(mapElement().getAttribute('data-object')).toBe('Sun');
    expect(mapElement().getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
  });

  it('stacks location, full-width map, then settings and results side by side', async () => {
    render(<Harness />);
    await waitForMap();

    const workspace = screen.getByTestId('finder-workspace');
    expect(workspace.className).toContain('space-y-6');

    const sections = Array.from(workspace.children) as HTMLElement[];
    expect(sections.map((el) => el.getAttribute('data-testid'))).toEqual([
      'location-controls',
      'mock-workspace-map',
      'alignment-columns'
    ]);
    expect(sections[1].className).toContain('lg:h-[620px]');
    expect(within(sections[0]).getByText('Location')).toBeTruthy();

    const columns = Array.from(sections[2].children) as HTMLElement[];
    expect(columns.map((el) => el.getAttribute('data-testid'))).toEqual([
      'alignment-settings-card',
      'alignment-results-card'
    ]);
    expect(sections[2].className).toContain('lg:grid-cols-2');
    expect(within(columns[0]).getByText('Alignment settings')).toBeTruthy();
    expect(within(columns[1]).getByText('Alignment results')).toBeTruthy();
  });

  it('passes the selected event azimuth to the map as the sun direction', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    const map = await waitForMap();

    expect(map.getAttribute('data-sun-object')).toBe('Sun');
    expect(Number(map.getAttribute('data-sun-azimuth'))).toBeGreaterThan(0);
    expect(map.getAttribute('data-sun-azimuth')).toBe(map.getAttribute('data-object-azimuth'));
  });

  it('updates the map to the selected result without moving the viewport', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    const map = await waitForMap();
    const fitBefore = map.getAttribute('data-fit-id');

    const items = resultItems();
    expect(items.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(items[1]);

    const mapAfter = mapElement();
    const itemsAfter = resultItems();
    expect(itemsAfter[1].getAttribute('aria-pressed')).toBe('true');
    expect(mapAfter.getAttribute('data-azimuth-label')).toBe(`${eventLabelOf(itemsAfter[1])} azimuth`);
    expect(mapAfter.getAttribute('data-fit-id')).toBe(fitBefore);
    expect(mapAfter.getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(mapAfter.getAttribute('data-target-lon')).toBe(String(DEFAULT_TARGET.longitude));
  });

  it('does not move the viewport when a marker is dragged after a search', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    await waitForMap();
    const fitBefore = mapElement().getAttribute('data-fit-id');

    fireEvent.click(screen.getByText('simulate-observer-move'));

    expect(mapElement().getAttribute('data-observer-lat')).toBe('1.5');
    expect(mapElement().getAttribute('data-observer-lon')).toBe('104.2');
    expect(mapElement().getAttribute('data-fit-id')).toBe(fitBefore);
    expect(screen.getByText(/location changed/i)).toBeTruthy();
  });

  it('shows only alignments within tolerance', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    expect(foundCountText()).toBeGreaterThanOrEqual(1);

    const items = resultItems();
    expect(items).toHaveLength(foundCountText());
    for (const item of items) {
      expect(item.textContent).toContain('✓');
    }
  });

  it('marks results stale when the location changes and keeps the previous results visible', async () => {
    render(<Harness />);
    fireEvent.click(findButton());
    await waitForResults();
    const map = await waitForMap();
    const azimuthBefore = map.getAttribute('data-object-azimuth');

    editObserverLatitude('1.5');

    expect(screen.getByText(/location changed/i)).toBeTruthy();
    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(findButton()).toBeTruthy();
    expect(resultItems().length).toBeGreaterThan(0);
    expect(mapElement().getAttribute('data-object-azimuth')).toBe(azimuthBefore);
    expect(mapElement().getAttribute('data-observer-lat')).toBe('1.5');
  });

  it('searching an observer location updates the observer marker and refits the whole map', async () => {
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

    fireEvent.change(screen.getByPlaceholderText('Search for an address, postal code or place...'), {
      target: { value: 'Singapore Polytechnic' }
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Singapore Polytechnic'));

    expect(mapElement().getAttribute('data-observer-lat')).toBe('1.3099');
    expect(mapElement().getAttribute('data-observer-lon')).toBe('103.7781');
    expect(mapElement().getAttribute('data-target-lat')).toBe(String(DEFAULT_TARGET.latitude));
    expect(mapElement().getAttribute('data-fit-target')).toBe('both');
    expect(mapElement().getAttribute('data-fit-id')).toBe('1');
    vi.useRealTimers();
  });

  it('shows a validation error and does not search when coordinates are invalid', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /edit observer location/i }));
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });
    expect(screen.getAllByText(/latitude must be between/i).length).toBeGreaterThan(0);

    fireEvent.click(findButton());

    expect(screen.getByText(/enter valid coordinates to search/i)).toBeTruthy();
    expect(searchedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
  });

  it('shows the moon phase on Moon results and none on Sun results', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
    fireEvent.change(screen.getByLabelText('Search from'), { target: { value: '2025-09-20' } });
    fireEvent.change(screen.getByLabelText('Search until'), { target: { value: '2025-09-22' } });
    fireEvent.click(findButton());

    await waitForResults();

    const phaseCells = screen.getAllByTestId('moon-phase');
    expect(phaseCells.length).toBeGreaterThan(0);
    for (const cell of phaseCells) {
      expect(cell.getAttribute('data-phase-name')).toMatch(
        /^(New Moon|Waxing Crescent|First Quarter|Waxing Gibbous|Full Moon|Waning Gibbous|Last Quarter|Waning Crescent)$/
      );
      expect(cell.textContent).toMatch(/🌑|🌒|🌓|🌔|🌕|🌖|🌗|🌘/);
    }

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Sun' } });
    fireEvent.click(findButton());
    await waitForResults();

    expect(screen.queryAllByTestId('moon-phase')).toHaveLength(0);
  });

  it('shows the time filter for the Moon and hides it for the Sun', () => {
    render(<Harness />);

    expect(screen.queryByLabelText('Time filter')).toBeNull();

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });

    expect(screen.getByLabelText('Time filter')).toBeTruthy();
  });

  it('filters Moon results to the night window', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
    fireEvent.change(screen.getByLabelText('Search from'), { target: { value: '2025-09-20' } });
    fireEvent.change(screen.getByLabelText('Search until'), { target: { value: '2025-09-22' } });
    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'night' } });
    fireEvent.click(findButton());

    await waitForResults();

    const items = resultItems();
    expect(items.length).toBe(4);
    for (const item of items) {
      const time = within(item).getByText(/^\d{2}:\d{2}:\d{2}$/).textContent ?? '';
      expect(isTimeWithinWindow(time, { start: '18:00', end: '07:00' })).toBe(true);
    }
  });

  it('applies a custom crossing-midnight time window to Moon results', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
    fireEvent.change(screen.getByLabelText('Search from'), { target: { value: '2025-09-20' } });
    fireEvent.change(screen.getByLabelText('Search until'), { target: { value: '2025-09-22' } });
    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '07:00' } });
    fireEvent.click(findButton());

    await waitForResults();

    const items = resultItems();
    expect(items.length).toBe(4);
    for (const item of items) {
      const time = within(item).getByText(/^\d{2}:\d{2}:\d{2}$/).textContent ?? '';
      expect(isTimeWithinWindow(time, { start: '18:00', end: '07:00' })).toBe(true);
    }
  });
});
