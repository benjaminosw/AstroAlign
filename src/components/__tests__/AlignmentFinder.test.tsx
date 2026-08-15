import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AlignmentFinder from '../AlignmentFinder';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';

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

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <AlignmentFinder
      observer={observer}
      target={target}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      observerCoordinateError={observerCoordinateError}
      onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
    />
  );
}

function findButton() {
  return screen.getByRole('button', { name: /find alignments/i });
}

function searchedButton() {
  return screen.queryByRole('button', { name: /searched/i });
}

function mapElement() {
  return screen.getByTestId('mock-alignment-map');
}

async function waitForMap() {
  return screen.findByTestId('mock-alignment-map', {}, { timeout: 3000 });
}

function foundCountText() {
  const element = screen.getByText(/^\d+ alignments? found$/i);
  return Number(element.textContent?.match(/\d+/)?.[0]);
}

function labelOf(item: HTMLElement) {
  const match = item.textContent?.match(/[↑↓] ([A-Za-z]+)/);
  return match ? match[1] : '';
}

function resultItems() {
  return screen.getAllByRole('listitem').map((item) => within(item).getByRole('button'));
}

describe('AlignmentFinder workspace', () => {
  it('starts in needs-search state with a bright button and placeholder results', () => {
    render(<Harness />);

    const button = findButton();
    expect(button.className).toContain('bg-emerald-500');
    expect(searchedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
    expect(screen.queryByTestId('mock-alignment-map')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('shows results, marks inputs as searched, and auto-selects the first result on the map', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());

    const found = await screen.findByText(/alignments? found/i, {}, { timeout: 5000 });
    expect(found.textContent).toMatch(/[1-9]\d* alignments? found/);
    expect(searchedButton()?.className).toContain('bg-slate-700');
    expect(screen.queryByText(/inputs changed/i)).toBeNull();

    const items = resultItems();
    expect(items).toHaveLength(foundCountText());
    expect(items.filter((item) => item.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(items[0].getAttribute('aria-pressed')).toBe('true');

    const map = await waitForMap();
    expect(map.getAttribute('data-object')).toBe('Sun');
    expect(map.getAttribute('data-azimuth-label')).toBe(`${labelOf(items[0])} azimuth`);
    expect(Number(map.getAttribute('data-object-azimuth'))).toBeGreaterThan(0);
    expect(Number(map.getAttribute('data-target-bearing'))).toBeGreaterThan(0);
    expect(map.getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(map.getAttribute('data-observer-lon')).toBe(String(DEFAULT_OBSERVER.longitude));
    expect(map.getAttribute('data-target-lat')).toBe(String(DEFAULT_TARGET.latitude));
    expect(map.getAttribute('data-target-lon')).toBe(String(DEFAULT_TARGET.longitude));
    expect(Number(map.getAttribute('data-fit-id'))).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Selected:/i)).toBeTruthy();
  });

  it('marks inputs as changed after a search while keeping the previous results and map visible', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());
    await screen.findByText(/alignments? found/i, {}, { timeout: 5000 });
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

  it('uses a two-column desktop layout with controls on the left and results on the right', () => {
    render(<Harness />);

    const workspace = screen.getByTestId('finder-workspace');
    expect(workspace.className).toContain('lg:grid-cols-[');

    const columns = Array.from(workspace.children) as HTMLElement[];
    expect(columns).toHaveLength(2);
    expect(within(columns[0]).getByText('Observer')).toBeTruthy();
    expect(within(columns[0]).getByText('Search')).toBeTruthy();
    expect(columns[0].className).toContain('lg:sticky');
    expect(within(columns[1]).getByText('Search results')).toBeTruthy();
  });

  it('updates the map to the selected result and refits when a different result is chosen', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());
    await screen.findByText(/alignments? found/i, {}, { timeout: 5000 });
    const map = await waitForMap();
    const fitBefore = Number(map.getAttribute('data-fit-id'));
    expect(Number(fitBefore)).toBeGreaterThanOrEqual(1);

    const items = resultItems();
    expect(items.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(items[1]);

    const mapAfter = mapElement();
    const itemsAfter = resultItems();
    expect(itemsAfter[1].getAttribute('aria-pressed')).toBe('true');
    expect(mapAfter.getAttribute('data-azimuth-label')).toBe(`${labelOf(itemsAfter[1])} azimuth`);
    expect(Number(mapAfter.getAttribute('data-fit-id'))).toBeGreaterThan(fitBefore);
    expect(mapAfter.getAttribute('data-observer-lat')).toBe(String(DEFAULT_OBSERVER.latitude));
    expect(mapAfter.getAttribute('data-target-lon')).toBe(String(DEFAULT_TARGET.longitude));
  });

  it('filters the list to matches within tolerance when the toggle is on', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());
    await screen.findByText(/alignments? found/i, {}, { timeout: 5000 });
    expect(foundCountText()).toBeGreaterThanOrEqual(2);
    expect(resultItems()).toHaveLength(foundCountText());

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));

    const filteredCount = foundCountText();
    if (filteredCount === 0) {
      expect(screen.getByText(/no alignments found/i)).toBeTruthy();
    } else {
      const items = resultItems();
      expect(items).toHaveLength(filteredCount);
      for (const item of items) {
        expect(item.textContent).toContain('Match');
      }
      expect(items.filter((item) => item.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    }
  });

  it('shows a validation error and does not search when coordinates are invalid', () => {
    render(<Harness />);

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });
    fireEvent.click(findButton());

    expect(screen.getAllByText(/latitude must be between/i).length).toBeGreaterThan(0);
    expect(searchedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
  });
});
