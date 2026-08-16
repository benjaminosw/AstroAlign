import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AlignmentFinder from '../AlignmentFinder';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';
import type { AlignmentCandidate } from '../../lib/alignment/types';
import type { MoonPhaseInfo } from '../../lib/astronomy/lunarPhase';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

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

const PHASES: Record<string, MoonPhaseInfo> = {
  'Waxing Gibbous': { name: 'Waxing Gibbous', emoji: '🌔', phaseAngle: 135, illuminationPercent: 75 },
  'Full Moon': { name: 'Full Moon', emoji: '🌕', phaseAngle: 180, illuminationPercent: 100 },
  'New Moon': { name: 'New Moon', emoji: '🌑', phaseAngle: 0, illuminationPercent: 0 },
  'Waning Crescent': { name: 'Waning Crescent', emoji: '🌘', phaseAngle: 315, illuminationPercent: 12 }
};

function candidate(
  phaseName: string,
  localDate: string,
  localTime: string,
  utcInstant: string,
  withinTolerance: boolean = true
): AlignmentCandidate {
  const phase = PHASES[phaseName];
  return {
    utcInstant,
    eventType: 'rise',
    eventLabel: 'Moonrise',
    localDate,
    localTime,
    timeZone: 'Asia/Singapore',
    timeZoneLabel: 'SGT',
    score: 0.5,
    moonPhase: phase,
    moonIlluminationPercent: phase.illuminationPercent,
    object: { azimuth: 77, altitude: 0 },
    target: { bearing: 76, distanceKm: 10, altitude: 0 },
    alignment: { angularSeparation: 0.5, azimuthDelta: 0.5, altitudeDelta: 0, withinTolerance }
  };
}

const SIX_CANDIDATES = [
  candidate('Waxing Gibbous', '2025-09-20', '12:00:00', '2025-09-20T04:00:00Z'),
  candidate('Full Moon', '2025-09-20', '19:00:00', '2025-09-20T11:00:00Z'),
  candidate('Full Moon', '2025-09-20', '20:00:00', '2025-09-20T12:00:00Z'),
  candidate('Waxing Gibbous', '2025-09-20', '20:30:00', '2025-09-20T12:30:00Z'),
  candidate('New Moon', '2025-09-20', '23:00:00', '2025-09-20T15:00:00Z'),
  candidate('Waning Crescent', '2025-09-21', '05:30:00', '2025-09-20T21:30:00Z')
];

const FULL_MOON_WINDOW_CANDIDATES = [
  candidate('Full Moon', '2025-09-06', '06:50:00', '2025-09-06T22:50:00Z'),
  candidate('Full Moon', '2025-09-07', '18:50:00', '2025-09-07T10:50:00Z'),
  candidate('Full Moon', '2025-09-10', '19:00:00', '2025-09-10T11:00:00Z')
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

async function searchMoon() {
  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
  fireEvent.click(screen.getByRole('button', { name: /find alignments/i }));
  await screen.findByTestId('results-count', {}, { timeout: 5000 });
}

function resultItems() {
  return screen.getAllByTestId('alignment-result-item');
}

function countText() {
  return screen.getByTestId('results-count').textContent ?? '';
}

function setMoonPhaseFilter(phaseName: string, checked: boolean) {
  const input = screen.getByLabelText(phaseName) as HTMLInputElement;
  if (input.checked !== checked) {
    fireEvent.click(input);
  }
}

describe('AlignmentFinder result filters', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(findAlignments).mockResolvedValue(SIX_CANDIDATES);
  });

  it('shows the Moon phase filter only when the object is Moon', () => {
    render(<Harness />);

    expect(screen.queryByText('Moon phase')).toBeNull();
    expect(screen.queryByLabelText('Waxing Gibbous')).toBeNull();

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });

    expect(screen.getByText('Moon phase')).toBeTruthy();
    for (const name of [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent'
    ]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
  });

  it('defaults to all phases selected', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });

    for (const name of [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent'
    ]) {
      expect((screen.getByLabelText(name) as HTMLInputElement).checked).toBe(true);
    }
  });

  it('narrows the displayed results instantly when a phase is deselected without recalculating', async () => {
    render(<Harness />);
    await searchMoon();

    expect(countText()).toBe('6 alignments');
    expect(resultItems()).toHaveLength(6);
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);

    setMoonPhaseFilter('Waxing Gibbous', false);

    expect(countText()).toBe('6 alignments found · 4 shown');
    expect(resultItems()).toHaveLength(4);
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /searched/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /find alignments/i })).toBeNull();
  });

  it('keeps a result selected while filters change', async () => {
    render(<Harness />);
    await searchMoon();

    expect(resultItems()[0].getAttribute('aria-pressed')).toBe('true');

    setMoonPhaseFilter('Waxing Gibbous', false);
    fireEvent.click(resultItems()[0]);

    const pressed = resultItems().filter((item) => item.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });

  it('combines selected phases with OR semantics', async () => {
    render(<Harness />);
    await searchMoon();

    setMoonPhaseFilter('Full Moon', false);
    setMoonPhaseFilter('New Moon', false);
    setMoonPhaseFilter('Waning Crescent', false);

    expect(countText()).toBe('6 alignments found · 2 shown');
    const phases = resultItems().map((item) => within(item).getByTestId('moon-phase').getAttribute('data-phase-name'));
    expect(phases).toEqual(['Waxing Gibbous', 'Waxing Gibbous']);
  });

  it('combines phase and time filters with AND semantics', async () => {
    render(<Harness />);
    await searchMoon();

    setMoonPhaseFilter('New Moon', false);
    setMoonPhaseFilter('Waning Crescent', false);
    setMoonPhaseFilter('Waxing Gibbous', false);
    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'night' } });

    expect(countText()).toBe('6 alignments found · 2 shown');
    const phases = resultItems().map((item) => within(item).getByTestId('moon-phase').getAttribute('data-phase-name'));
    expect(phases).toEqual(['Full Moon', 'Full Moon']);
  });

  it('applies a custom crossing-midnight time window instantly', async () => {
    render(<Harness />);
    await searchMoon();

    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '20:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '04:00' } });

    expect(countText()).toBe('6 alignments found · 3 shown');
    const times = resultItems().map((item) => item.children[3].textContent);
    expect(times).toEqual(['20:00:00', '20:30:00', '23:00:00']);
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('counts only within-tolerance alignments as found and shown', async () => {
    const mixed = [
      candidate('Full Moon', '2025-09-20', '19:00:00', '2025-09-20T11:00:00Z', true),
      candidate('Full Moon', '2025-09-20', '20:00:00', '2025-09-20T12:00:00Z', true),
      candidate('Waxing Gibbous', '2025-09-20', '20:30:00', '2025-09-20T12:30:00Z', true),
      candidate('New Moon', '2025-09-21', '23:00:00', '2025-09-21T15:00:00Z', true),
      candidate('Waning Crescent', '2025-09-21', '05:30:00', '2025-09-20T21:30:00Z', true),
      candidate('Full Moon', '2025-09-20', '12:00:00', '2025-09-20T04:00:00Z', false),
      candidate('Full Moon', '2025-09-20', '18:00:00', '2025-09-20T10:00:00Z', false)
    ];
    vi.mocked(findAlignments).mockResolvedValue(mixed);
    render(<Harness />);
    await searchMoon();

    expect(countText()).toBe('5 alignments');
    expect(resultItems()).toHaveLength(5);

    setMoonPhaseFilter('Waxing Gibbous', false);
    expect(countText()).toBe('5 alignments found · 4 shown');
    expect(resultItems()).toHaveLength(4);

    setMoonPhaseFilter('New Moon', false);
    setMoonPhaseFilter('Waning Crescent', false);
    expect(countText()).toBe('5 alignments found · 2 shown');
    for (const item of resultItems()) {
      expect(item.textContent).toContain('✓');
    }
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('shows a dedicated message when no phases are selected', async () => {
    render(<Harness />);
    await searchMoon();

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));

    expect(screen.getByText('No Moon phases selected.')).toBeTruthy();
    expect(screen.getByText('Select at least one phase to display results.')).toBeTruthy();
    expect(countText()).toBe('6 alignments found · 0 shown');
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('selects all phases back with Select all', async () => {
    render(<Harness />);
    await searchMoon();

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(countText()).toBe('6 alignments found · 0 shown');

    fireEvent.click(screen.getByRole('button', { name: /select all/i }));

    expect(countText()).toBe('6 alignments');
    expect(resultItems()).toHaveLength(6);
  });

  it('shows the empty filtered-state message and Clear filters restores everything', async () => {
    render(<Harness />);
    await searchMoon();

    setMoonPhaseFilter('Waxing Gibbous', false);
    setMoonPhaseFilter('Full Moon', false);
    setMoonPhaseFilter('New Moon', false);
    setMoonPhaseFilter('Waning Crescent', false);

    expect(screen.getByText('No results match the current filters.')).toBeTruthy();
    expect(screen.getByText('6 alignments were calculated.')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0]);

    expect(countText()).toBe('6 alignments');
    expect(resultItems()).toHaveLength(6);
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('changing a calculation parameter marks the results stale without refiltering', async () => {
    render(<Harness />);
    await searchMoon();

    fireEvent.change(screen.getByLabelText('Maximum azimuth difference'), { target: { value: '1' } });

    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /find alignments/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /searched/i })).toBeNull();
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('applies the Full Moon date window filter to the calculated results', async () => {
    vi.mocked(findAlignments).mockResolvedValue(FULL_MOON_WINDOW_CANDIDATES);
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
    fireEvent.change(screen.getByLabelText('Search from'), { target: { value: '2025-09-06' } });
    fireEvent.change(screen.getByLabelText('Search until'), { target: { value: '2025-09-10' } });
    fireEvent.click(screen.getByRole('button', { name: /find alignments/i }));
    await screen.findByTestId('results-count', {}, { timeout: 5000 });

    expect(countText()).toBe('3 alignments');

    fireEvent.click(screen.getByLabelText('Full Moon date window'));

    expect(countText()).toBe('3 alignments found · 2 shown');
    const dates = resultItems().map((item) => item.children[2].textContent);
    expect(dates).toEqual(['06/09/2025', '07/09/2025']);
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });

  it('Clear filters resets phase, time, and full-moon filters without recalculating', async () => {
    render(<Harness />);
    await searchMoon();

    fireEvent.click(screen.getByLabelText('Full Moon date window'));
    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'night' } });
    setMoonPhaseFilter('Full Moon', false);
    setMoonPhaseFilter('New Moon', false);
    setMoonPhaseFilter('Waning Crescent', false);

    expect(countText()).toBe('6 alignments found · 0 shown');

    fireEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0]);

    expect(countText()).toBe('6 alignments');
    expect((screen.getByLabelText('Time filter') as HTMLSelectElement).value).toBe('any');
    expect((screen.getByLabelText('Full Moon date window') as HTMLInputElement).checked).toBe(false);
    for (const name of ['Full Moon', 'New Moon', 'Waning Crescent']) {
      expect((screen.getByLabelText(name) as HTMLInputElement).checked).toBe(true);
    }
    expect(vi.mocked(findAlignments)).toHaveBeenCalledTimes(1);
  });
});
