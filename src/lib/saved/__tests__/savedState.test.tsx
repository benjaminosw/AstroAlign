import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SavedLocationsProvider, useSavedLocations } from '../savedState';
import type { SavedShootingGeometry, SavedShootingLocation, SavedTarget } from '../types';
import { AppStateProvider, useAppState } from '../../storage/appState';
import { loadAllData } from '../../storage/repository';

function HydratedHarness({ children }: { children: ReactNode }) {
  const { isHydrated } = useAppState();
  if (!isHydrated) {
    return null;
  }
  return <SavedLocationsProvider>{children}</SavedLocationsProvider>;
}

function Probe() {
  const value = useSavedLocations();
  return (
    <div>
      <button
        onClick={() => value.addTarget({ name: 'Tower A', latitude: 1.31, longitude: 103.88 })}
        data-testid="add-target"
      />
      <button
        onClick={() =>
          value.addTarget({ name: 'Tower B', latitude: 2.2, longitude: 104.9 })
        }
        data-testid="add-target-b"
      />
      <button
        onClick={() =>
          value.addShootingLocation({
            name: 'Park',
            geometry: { type: 'point', point: { id: 'p1', name: '', latitude: 1.31, longitude: 103.88 } }
          })
        }
        data-testid="add-location"
      />
      <button onClick={() => value.addSetup({ name: 'Setup 1', targetId: value.targets[0]?.id ?? '', shootingLocationId: value.shootingLocations[0]?.id ?? '' })} data-testid="add-setup" />
      <button onClick={() => value.deleteTarget(value.targets[0]?.id ?? '')} data-testid="delete-target" />
      <button onClick={() => value.deleteShootingLocation(value.shootingLocations[0]?.id ?? '')} data-testid="delete-location" />
      <button onClick={() => value.deleteSetup(value.setups[0]?.id ?? '')} data-testid="delete-setup" />
      <button onClick={() => value.bindTarget('bound-1')} data-testid="bind-target" />
      <button onClick={() => value.updateTarget(value.targets[0]?.id ?? '', { name: 'Renamed' })} data-testid="update-target" />
      <ul data-testid="targets">
        {value.targets.map((target) => (
          <li key={target.id} data-testid={`target-${target.name}`}>
            {target.latitude},{target.longitude}:{target.elevation ?? 'null'}
          </li>
        ))}
      </ul>
      <ul data-testid="locations">
        {value.shootingLocations.map((location) => (
          <li key={location.id} data-testid={`location-${location.name}`} />
        ))}
      </ul>
      <ul data-testid="setups">
        {value.setups.map((setup) => (
          <li key={setup.id} data-testid={`setup-${setup.name}`} />
        ))}
      </ul>
      <span data-testid="bound">{value.boundTargetId ?? 'none'}</span>
      <span data-testid="matched">{value.findTargetByCoordinates(1.31, 103.88)?.name ?? 'none'}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <SavedLocationsProvider>
      <Probe />
    </SavedLocationsProvider>
  );
}

const pointGeometry: SavedShootingGeometry = {
  type: 'point',
  point: { id: 'p1', name: '', latitude: 1.31, longitude: 103.88 }
};

describe('SavedLocationsProvider', () => {
  it('starts empty and adds targets, locations, and setups', async () => {
    renderProbe();

    expect(screen.queryAllByTestId(/^target-/)).toHaveLength(0);
    fireEvent.click(screen.getByTestId('add-target'));
    fireEvent.click(screen.getByTestId('add-target-b'));
    fireEvent.click(screen.getByTestId('add-location'));
    fireEvent.click(screen.getByTestId('add-setup'));

    await waitFor(() => {
      expect(screen.getAllByTestId(/^target-/)).toHaveLength(2);
      expect(screen.getAllByTestId(/^location-/)).toHaveLength(1);
      expect(screen.getAllByTestId(/^setup-/)).toHaveLength(1);
    });
  });

  it('persists saved items to IndexedDB and reloads them on a fresh provider', async () => {
    const first = render(
      <AppStateProvider>
        <HydratedHarness>
          <Probe />
        </HydratedHarness>
      </AppStateProvider>
    );
    fireEvent.click(await screen.findByTestId('add-target'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^target-/)).toHaveLength(1);
    });

    await waitFor(async () => {
      const data = await loadAllData();
      expect(data.targets).toHaveLength(1);
      expect(data.targets[0].name).toBe('Tower A');
    });

    first.unmount();

    render(
      <AppStateProvider>
        <HydratedHarness>
          <Probe />
        </HydratedHarness>
      </AppStateProvider>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId(/^target-/)).toHaveLength(1);
      expect(screen.getByTestId('target-Tower A')).toBeTruthy();
    });
  });

  it('finds targets by coordinates and returns null when absent', async () => {
    renderProbe();
    fireEvent.click(screen.getByTestId('add-target'));
    await waitFor(() => {
      expect(screen.getByTestId('matched').textContent).toBe('Tower A');
    });
  });

  it('updates a target and keeps bindings in memory', async () => {
    renderProbe();
    fireEvent.click(screen.getByTestId('add-target'));
    await waitFor(() => {
      expect(screen.getByTestId('target-Tower A')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('bind-target'));
    expect(screen.getByTestId('bound').textContent).toBe('bound-1');

    fireEvent.click(screen.getByTestId('update-target'));
    await waitFor(() => {
      expect(screen.getByTestId('target-Renamed')).toBeTruthy();
    });
  });

  it('deletes a target and cascades its setups', async () => {
    renderProbe();
    fireEvent.click(screen.getByTestId('add-target'));
    fireEvent.click(screen.getByTestId('add-location'));
    fireEvent.click(screen.getByTestId('add-setup'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^setup-/)).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('delete-target'));
    await waitFor(() => {
      expect(screen.queryAllByTestId(/^target-/)).toHaveLength(0);
      expect(screen.queryAllByTestId(/^setup-/)).toHaveLength(0);
    });
  });

  it('deletes a location and cascades its setups', async () => {
    renderProbe();
    fireEvent.click(screen.getByTestId('add-target'));
    fireEvent.click(screen.getByTestId('add-location'));
    fireEvent.click(screen.getByTestId('add-setup'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^setup-/)).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('delete-location'));
    await waitFor(() => {
      expect(screen.queryAllByTestId(/^location-/)).toHaveLength(0);
      expect(screen.queryAllByTestId(/^setup-/)).toHaveLength(0);
    });
  });

  it('matches shooting locations by geometry key', async () => {
    let located: SavedShootingLocation | null = null;
    function MatchProbe() {
      const value = useSavedLocations();
      return (
        <div>
          <button
            onClick={() => {
              const created = value.addShootingLocation({ name: 'Park', geometry: pointGeometry });
              located = created;
            }}
            data-testid="create"
          />
          <span data-testid="match">{value.findShootingLocationByGeometryKey('point:1.310000,103.880000')?.name ?? 'none'}</span>
        </div>
      );
    }
    render(
      <SavedLocationsProvider>
        <MatchProbe />
      </SavedLocationsProvider>
    );

    expect(screen.getByTestId('match').textContent).toBe('none');
    fireEvent.click(screen.getByTestId('create'));
    await waitFor(() => {
      expect(screen.getByTestId('match').textContent).toBe('Park');
    });
    expect(located).not.toBeNull();
  });

  it('uses generated names when none are provided', async () => {
    function GeneratedProbe() {
      const value = useSavedLocations();
      return (
        <div>
          <button
            onClick={() => value.addTarget({ latitude: 1.31, longitude: 103.88 })}
            data-testid="add"
          />
          <ul>
            {value.targets.map((target) => (
              <li key={target.id} data-testid={`generated-${target.name}`} />
            ))}
          </ul>
        </div>
      );
    }
    render(
      <SavedLocationsProvider>
        <GeneratedProbe />
      </SavedLocationsProvider>
    );
    fireEvent.click(screen.getByTestId('add'));
    await waitFor(() => {
      expect(screen.getByTestId('generated-Target 1.310000,103.880000')).toBeTruthy();
    });
  });

  it('strips surrounding whitespace from names and notes', async () => {
    let created: SavedTarget | null = null;
    function TrimProbe() {
      const value = useSavedLocations();
      return (
        <button
          onClick={() => {
            created = value.addTarget({ name: '  Tower  ', latitude: 1, longitude: 2, notes: '  hi  ' });
          }}
          data-testid="add"
        />
      );
    }
    render(
      <SavedLocationsProvider>
        <TrimProbe />
      </SavedLocationsProvider>
    );
    fireEvent.click(screen.getByTestId('add'));
    await waitFor(() => {
      expect(created?.name).toBe('Tower');
      expect(created?.notes).toBe('hi');
    });
  });

  it('resetAll clears in-memory state and the database', async () => {
    function ResetProbe() {
      const value = useSavedLocations();
      return (
        <div>
          <button onClick={() => value.addTarget({ name: 'X', latitude: 1, longitude: 2 })} data-testid="add" />
          <button onClick={() => value.resetAll()} data-testid="reset" />
          <ul>{value.targets.map((target) => <li key={target.id} data-testid={`t-${target.name}`} />)}</ul>
        </div>
      );
    }
    render(
      <AppStateProvider>
        <HydratedHarness>
          <ResetProbe />
        </HydratedHarness>
      </AppStateProvider>
    );
    fireEvent.click(await screen.findByTestId('add'));
    await waitFor(async () => {
      const data = await loadAllData();
      expect(data.targets).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('t-X')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reset'));
    await waitFor(() => {
      expect(screen.queryByTestId('t-X')).toBeNull();
    });
    await waitFor(async () => {
      const data = await loadAllData();
      expect(data.targets).toHaveLength(0);
    });
  });

  it('adds saved alignments, updates duplicates by dedupe key, and deletes them', async () => {
    function AlignmentProbe() {
      const value = useSavedLocations();
      return (
        <div>
          <button
            onClick={() =>
              value.addSavedAlignment({
                source: 'finder',
                object: 'Sun',
                event: 'rise',
                date: '2027-08-01',
                time: '07:00:00',
                celestialAzimuth: 90,
                targetBearing: 89.5,
                alignmentError: 0.5,
                targetId: null,
                shootingSetupId: null,
                observerSnapshot: null,
                targetSnapshot: null,
                shootingPositionSnapshot: null,
                shootingLocationSnapshot: null
              })
            }
            data-testid="save-alignment"
          />
          <button
            onClick={() =>
              value.addSavedAlignment({
                source: 'finder',
                object: 'Sun',
                event: 'rise',
                date: '2027-08-01',
                time: '07:00:00',
                celestialAzimuth: 90,
                targetBearing: 90,
                alignmentError: 0,
                targetId: null,
                shootingSetupId: null,
                observerSnapshot: null,
                targetSnapshot: null,
                shootingPositionSnapshot: null,
                shootingLocationSnapshot: null
              })
            }
            data-testid="save-alignment-again"
          />
          <button onClick={() => value.deleteSavedAlignment(value.savedAlignments[0]?.id ?? '')} data-testid="delete-alignment" />
          <span data-testid="count">{value.savedAlignments.length}</span>
          <span data-testid="first-error">{value.savedAlignments[0]?.alignmentError ?? 'none'}</span>
        </div>
      );
    }
    render(
      <SavedLocationsProvider>
        <AlignmentProbe />
      </SavedLocationsProvider>
    );

    fireEvent.click(screen.getByTestId('save-alignment'));
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
      expect(screen.getByTestId('first-error').textContent).toBe('0.5');
    });

    fireEvent.click(screen.getByTestId('save-alignment-again'));
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
      expect(screen.getByTestId('first-error').textContent).toBe('0');
    });

    fireEvent.click(screen.getByTestId('delete-alignment'));
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
  });
});
