import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FindShootingOpportunities from '../FindShootingOpportunities';
import { ShootingStateProvider } from '../../lib/opportunities/shootingState';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { ASTRO_OBJECT } from '../../types/astronomy';
import type { ShootingOpportunity } from '../../lib/opportunities/types';

vi.mock('../ShootingAreaMap', () => ({
  __esModule: true,
  default: (props: {
    target: { latitude: number; longitude: number };
    area: { type: string };
    cameraMarkers: unknown[];
    opportunities: unknown[];
    selectedId: string | null;
    highlight: { zoneStartKm: number; zoneEndKm: number } | null;
    onTargetMove: (_lat: number, _lng: number) => void;
    onAreaCameraMove: (_id: string, _lat: number, _lng: number) => void;
    panRequest?: { id: string; requestId: number } | null;
    fitId?: number;
  }) => (
    <div
      data-testid="mock-shooting-area-map"
      data-target-lat={props.target.latitude}
      data-target-lon={props.target.longitude}
      data-area-mode={props.area.type}
      data-camera-count={props.cameraMarkers.length}
      data-opp-count={props.opportunities?.length ?? 0}
      data-selected-id={props.selectedId ?? ''}
      data-zone-start={props.highlight?.zoneStartKm ?? ''}
      data-zone-end={props.highlight?.zoneEndKm ?? ''}
      data-pan-request-id={props.panRequest?.id ?? ''}
      data-fit-id={props.fitId ?? ''}
    >
      <button onClick={() => props.onTargetMove(1.5, 104.2)}>simulate-target-move</button>
      <button onClick={() => props.onAreaCameraMove('start', 1.31, 103.88)}>simulate-area-move</button>
    </div>
  )
}));

vi.mock('../../lib/opportunities/findShootingOpportunities', () => ({
  findShootingOpportunities: vi.fn()
}));

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { findShootingOpportunities } from '../../lib/opportunities/findShootingOpportunities';
import { activeGeocoder } from '../../lib/geocoding/index';

function opportunity(id: string, overrides: Partial<ShootingOpportunity> = {}): ShootingOpportunity {
  return {
    id,
    utcInstant: '2027-08-17T22:30:00Z',
    eventType: 'rise',
    eventLabel: 'Sunrise',
    localDate: '2027-08-17',
    localTime: '06:30:00',
    timeZone: 'Asia/Singapore',
    timeZoneLabel: 'SGT',
    object: ASTRO_OBJECT.Sun,
    objectAzimuth: 76.4,
    objectAltitude: 0,
    position: {
      latitude: 1.32,
      longitude: 103.9,
      bearingToTarget: 76.4,
      alignmentError: 0.3,
      distanceFromStartKm: 0.9,
      zoneStartKm: 0.7,
      zoneEndKm: 1.1,
      source: 'path'
    },
    score: 0.3,
    ...overrides
  };
}

function moonOpportunity(id: string, phaseName: string): ShootingOpportunity {
  return opportunity(id, {
    object: ASTRO_OBJECT.Moon,
    eventLabel: 'Moonrise',
    utcInstant: '2027-08-17T19:05:00Z',
    localTime: '03:05:00',
    moonPhase: { name: phaseName, emoji: '🌕', phaseAngle: 180, illuminationPercent: 100 },
    moonIlluminationPercent: 100
  });
}

const SUN_OPPORTUNITIES = [opportunity('opp-1'), opportunity('opp-2', { id: 'opp-2' })];
const MOON_OPPORTUNITIES = [moonOpportunity('moon-1', 'Full Moon'), moonOpportunity('moon-2', 'New Moon')];

function Harness() {
  const [target, setTarget] = useState(DEFAULT_TARGET);
  return (
    <ShootingStateProvider>
      <SavedLocationsProvider>
        <FindShootingOpportunities
          target={target}
          targetCoordinateError={null}
          timeZone="Asia/Singapore"
          timeZoneStatus="idle"
          onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
        />
      </SavedLocationsProvider>
    </ShootingStateProvider>
  );
}

function findButton() {
  return screen.getByRole('button', { name: /find opportunities/i });
}

function searchedButton() {
  return screen.queryByRole('button', { name: /searched/i });
}

function mapElement() {
  return screen.getByTestId('mock-shooting-area-map');
}

function setDates() {
  fireEvent.change(screen.getByLabelText('Search from'), { target: { value: '2027-08-17' } });
  fireEvent.change(screen.getByLabelText('Search until'), { target: { value: '2027-08-17' } });
}

async function searchAndWait() {
  setDates();
  fireEvent.click(findButton());
  return screen.findByTestId('opportunities-count', {}, { timeout: 5000 });
}

function countText() {
  return screen.getByTestId('opportunities-count').textContent ?? '';
}

function resultItems() {
  return screen.getAllByTestId('opportunity-result-item');
}

describe('FindShootingOpportunities workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(findShootingOpportunities).mockImplementation(async (input) => {
      return input.object === ASTRO_OBJECT.Moon ? [...MOON_OPPORTUNITIES] : [...SUN_OPPORTUNITIES];
    });
  });

  it('starts with search settings, area controls, and placeholder results', async () => {
    render(<Harness />);

    expect(screen.getByLabelText('Object')).toBeTruthy();
    expect(screen.getByLabelText('Event')).toBeTruthy();
    expect(screen.getByLabelText('Search from')).toBeTruthy();
    expect(screen.getByLabelText('Search until')).toBeTruthy();
    expect(screen.getByLabelText('Maximum azimuth difference')).toBeTruthy();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
    expect(screen.getByText(/geometric alignment only/i)).toBeTruthy();
    expect(screen.queryByText('Moon phase')).toBeNull();
    expect(screen.getByTestId('area-mode-path').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('area-mode-points').getAttribute('aria-checked')).toBe('false');
    expect(await screen.findByTestId('mock-shooting-area-map', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('runs a search and displays ranked opportunities with the first selected', async () => {
    render(<Harness />);

    const count = await searchAndWait();
    expect(count.textContent).toMatch(/2 opportunities/);
    expect(searchedButton()).toBeTruthy();
    expect(screen.queryByText(/inputs changed/i)).toBeNull();

    const items = resultItems();
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('aria-pressed')).toBe('true');
    expect(items[1].getAttribute('aria-pressed')).toBe('false');

    expect(mapElement().getAttribute('data-opp-count')).toBe('2');
    expect(mapElement().getAttribute('data-selected-id')).toBe('opp-1');

    expect(findShootingOpportunities).toHaveBeenCalledTimes(1);
    expect(findShootingOpportunities).toHaveBeenCalledWith(
      expect.objectContaining({ object: ASTRO_OBJECT.Sun, eventType: 'rise' })
    );
  });

  it('shows the Moon phase filters only when Moon is selected', async () => {
    render(<Harness />);

    expect(screen.queryByText('Moon phase')).toBeNull();
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: ASTRO_OBJECT.Moon } });
    expect(screen.getByText('Moon phase')).toBeTruthy();
    expect(screen.getByLabelText('Full Moon date window')).toBeTruthy();
  });

  it('filters visible results without re-running the search', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: ASTRO_OBJECT.Moon } });
    await searchAndWait();

    expect(countText()).toMatch(/2 opportunities/);
    expect(findShootingOpportunities).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));

    expect(countText()).toMatch(/2 opportunities found · 0 shown/);
    expect(screen.getByText('No results match the current filters.')).toBeTruthy();
    expect(findShootingOpportunities).toHaveBeenCalledTimes(1);

    const resultsCard = within(screen.getByTestId('shooting-opportunity-results'));
    fireEvent.click(resultsCard.getByRole('button', { name: /clear filters/i }));

    expect(countText()).toMatch(/2 opportunities/);
    expect(findShootingOpportunities).toHaveBeenCalledTimes(1);
  });

  it('marks results as stale when inputs change after a search', async () => {
    render(<Harness />);
    await searchAndWait();

    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'set' } });

    expect(searchedButton()).toBeNull();
    expect(findButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
  });

  it('marks results as stale when the target moves on the map', async () => {
    render(<Harness />);
    await searchAndWait();

    fireEvent.click(within(mapElement()).getByRole('button', { name: /simulate-target-move/i }));

    expect(searchedButton()).toBeNull();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
  });

  it('selecting a result updates the selected opportunity and requests a pan', async () => {
    render(<Harness />);
    await searchAndWait();

    fireEvent.click(resultItems()[1]);

    expect(mapElement().getAttribute('data-selected-id')).toBe('opp-2');
    expect(mapElement().getAttribute('data-zone-start')).toBe('0.7');
    expect(mapElement().getAttribute('data-zone-end')).toBe('1.1');
    expect(mapElement().getAttribute('data-pan-request-id')).toBe('opp-2');
  });

  it('requests a map recentre when a search result is selected', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', formattedAddress: '', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    const initialFit = mapElement().getAttribute('data-fit-id');
    const input = screen.getByRole('combobox', { name: /landmark/i });
    fireEvent.change(input, { target: { value: 'Marina Bay Sands' } });
    fireEvent.click(screen.getByRole('button', { name: /search landmark/i }));
    await screen.findByText('Marina Bay Sands');

    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(mapElement().getAttribute('data-fit-id')).not.toBe(initialFit);
  });

  it('reports an error when the search fails', async () => {
    vi.mocked(findShootingOpportunities).mockRejectedValueOnce(new Error('No valid rise event found.'));
    render(<Harness />);

    setDates();
    fireEvent.click(findButton());

    await waitFor(() => {
      expect(screen.getByText(/no valid rise event found/i)).toBeTruthy();
    });
    expect(searchedButton()).toBeNull();
  });

  it('supports switching to Points mode and adding points', async () => {
    render(<Harness />);

    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('area-mode-points'));

    expect(screen.getByTestId('area-mode-points').getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByLabelText('Name')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /add point/i })).toBeTruthy();
    expect(screen.getByLabelText('Shooting point')).toBeTruthy();

    fireEvent.click(screen.getByTestId('add-shooting-point'));

    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
    const map = await screen.findByTestId('mock-shooting-area-map', {}, { timeout: 3000 });
    expect(map.getAttribute('data-camera-count')).toBe('2');
    expect(map.getAttribute('data-area-mode')).toBe('points');
  });

  it('re-enables save when switching to a different unsaved opportunity', async () => {
    vi.mocked(findShootingOpportunities).mockResolvedValue([
      opportunity('opp-a', { localTime: '06:30:00', objectAzimuth: 76.4 }),
      opportunity('opp-b', { localDate: '2027-08-18', localTime: '06:31:00', objectAzimuth: 77.2 })
    ]);
    render(<Harness />);
    await searchAndWait();

    const saveButton = () => screen.getByTestId('save-alignment-button') as HTMLButtonElement;
    expect(saveButton().textContent).toBe('Save alignment');

    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(saveButton().textContent).toMatch(/saved/i);
      expect(saveButton().disabled).toBe(true);
    });

    fireEvent.click(resultItems()[1]);

    expect(saveButton().textContent).toBe('Save alignment');
    expect(saveButton().disabled).toBe(false);
  });

  it('shows the remaining count on Save all and saves every visible opportunity', async () => {
    vi.mocked(findShootingOpportunities).mockResolvedValue([
      opportunity('opp-a', { localTime: '06:30:00', objectAzimuth: 76.4 }),
      opportunity('opp-b', { localDate: '2027-08-18', localTime: '06:31:00', objectAzimuth: 77.2 })
    ]);
    render(<Harness />);
    await searchAndWait();

    const saveAllButton = () => screen.getByTestId('save-all-alignments-button') as HTMLButtonElement;
    expect(saveAllButton().textContent).toMatch(/Save all \(2\)/);

    fireEvent.click(saveAllButton());

    await waitFor(() => {
      expect(saveAllButton().textContent).toMatch(/All saved/i);
      expect(saveAllButton().disabled).toBe(true);
    });
    expect((screen.getByTestId('save-alignment-button') as HTMLButtonElement).textContent).toMatch(/saved/i);
  });

  it('Save all only saves opportunities that are not already saved', async () => {
    vi.mocked(findShootingOpportunities).mockResolvedValue([
      opportunity('opp-a', { localTime: '06:30:00', objectAzimuth: 76.4 }),
      opportunity('opp-b', { localDate: '2027-08-18', localTime: '06:31:00', objectAzimuth: 77.2 })
    ]);
    render(<Harness />);
    await searchAndWait();

    fireEvent.click(screen.getByTestId('save-alignment-button'));
    await waitFor(() => {
      expect(screen.getByTestId('save-all-alignments-button').textContent).toMatch(/Save all \(1\)/);
    });

    fireEvent.click(screen.getByTestId('save-all-alignments-button'));

    await waitFor(() => {
      const button = screen.getByTestId('save-all-alignments-button') as HTMLButtonElement;
      expect(button.textContent).toMatch(/All saved/i);
      expect(button.disabled).toBe(true);
    });
  });
});
