import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SavedLocationsProvider, useSavedLocations } from '../savedState';
import type { SavedShootingGeometry, SavedShootingLocation, SavedTarget } from '../types';

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
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it('persists saved items to localStorage and reloads them on a fresh provider', async () => {
    const first = renderProbe();
    fireEvent.click(screen.getByTestId('add-target'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^target-/)).toHaveLength(1);
    });

    const stored = window.localStorage.getItem('astroalign.saved.targets');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as { items: SavedTarget[] };
    expect(parsed.items[0].name).toBe('Tower A');

    first.unmount();

    renderProbe();
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

  it('resetAll clears in-memory state and localStorage', async () => {
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
      <SavedLocationsProvider>
        <ResetProbe />
      </SavedLocationsProvider>
    );
    fireEvent.click(screen.getByTestId('add'));
    await waitFor(() => {
      expect(screen.getByTestId('t-X')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reset'));
    await waitFor(() => {
      expect(screen.queryByTestId('t-X')).toBeNull();
      const stored = window.localStorage.getItem('astroalign.saved.targets');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored ?? '{}')).toEqual({ version: 1, items: [] });
    });
  });
});
