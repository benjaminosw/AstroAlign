import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SavedLocationsProvider, useSavedLocations } from '../../lib/saved/savedState';
import type { GeographicPoint } from '../../types/astronomy';
import type { ShootingArea } from '../../lib/opportunities/types';
import SaveTargetControl from '../SaveTargetControl';
import SaveShootingLocationControl from '../SaveShootingLocationControl';
import SaveSetupControl from '../SaveSetupControl';

const target: GeographicPoint = { latitude: 1.31, longitude: 103.88, elevation: 12 };
const pathArea: ShootingArea = {
  type: 'path',
  start: { id: 's', name: 'Start', latitude: 1.3, longitude: 103.9 },
  end: { id: 'e', name: 'End', latitude: 1.4, longitude: 104.0 }
};
const pointsArea: ShootingArea = {
  type: 'points',
  points: [
    { id: 'p1', name: 'Point A', latitude: 1.31, longitude: 103.88 },
    { id: 'p2', name: 'Point B', latitude: 1.32, longitude: 103.9 }
  ]
};

function wrapper(children: ReactNode) {
  return render(<SavedLocationsProvider>{children}</SavedLocationsProvider>);
}

describe('SaveTargetControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a save button when nothing is saved and creates a saved target', async () => {
    wrapper(<SaveTargetControl target={target} landmarkName={null} />);

    expect(screen.getByTestId('save-target-button')).toBeTruthy();
    fireEvent.click(screen.getByTestId('save-target-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-target-button')).toBeTruthy();
    });
    expect(screen.getByTestId('saved-target-button').textContent).toMatch(/Target 1\.310000,103\.880000/);
  });

  it('uses the landmark name when provided', async () => {
    wrapper(<SaveTargetControl target={target} landmarkName="Marina Bay" />);

    fireEvent.click(screen.getByTestId('save-target-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-target-button').textContent).toMatch(/Marina Bay/);
    });
  });

  it('shows saved state when the coordinates already match an existing target', () => {
    function Seed() {
      const { addTarget } = useSavedLocations();
      return <button data-testid="seed" onClick={() => addTarget({ name: 'Tower', latitude: 1.31, longitude: 103.88 })} />;
    }
    wrapper(
      <>
        <Seed />
        <SaveTargetControl target={target} landmarkName={null} />
      </>
    );

    fireEvent.click(screen.getByTestId('seed'));
    waitFor(() => {
      expect(screen.getByTestId('saved-target-button').textContent).toMatch(/Tower/);
      expect(screen.queryByTestId('save-target-button')).toBeNull();
    });
  });

  it('offers Save changes when the bound target no longer matches the coordinates', async () => {
    function BoundTarget() {
      const { addTarget, bindTarget } = useSavedLocations();
      return (
        <button
          data-testid="seed-bound"
          onClick={() => {
            const created = addTarget({ name: 'Bound', latitude: 0.5, longitude: 100.0 });
            bindTarget(created.id);
          }}
        />
      );
    }
    wrapper(
      <>
        <BoundTarget />
        <SaveTargetControl target={target} landmarkName={null} />
      </>
    );

    fireEvent.click(screen.getByTestId('seed-bound'));
    await waitFor(() => {
      expect(screen.getByTestId('save-target-changes')).toBeTruthy();
      expect(screen.getByTestId('saved-target-dirty')).toBeTruthy();
    });
  });
});

describe('SaveShootingLocationControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a saved shooting location from a path area', async () => {
    wrapper(<SaveShootingLocationControl area={pathArea} />);

    expect(screen.getByTestId('save-shooting-location-button')).toBeTruthy();
    fireEvent.click(screen.getByTestId('save-shooting-location-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-shooting-location-button')).toBeTruthy();
    });
  });

  it('shows saved state when the geometry already matches', async () => {
    function Seed() {
      const { addShootingLocation } = useSavedLocations();
      return (
        <button
          data-testid="seed"
          onClick={() =>
            addShootingLocation({
              name: 'Beach',
              geometry: {
                type: 'path',
                start: { id: 's', name: 'Start', latitude: 1.3, longitude: 103.9 },
                end: { id: 'e', name: 'End', latitude: 1.4, longitude: 104.0 }
              }
            })
          }
        />
      );
    }
    wrapper(
      <>
        <Seed />
        <SaveShootingLocationControl area={pathArea} />
      </>
    );

    fireEvent.click(screen.getByTestId('seed'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-shooting-location-button').textContent).toMatch(/Beach/);
      expect(screen.queryByTestId('save-shooting-location-button')).toBeNull();
    });
  });

  it('offers Save changes when the bound location geometry changes', async () => {
    function BoundLocation() {
      const { addShootingLocation, bindShootingLocation } = useSavedLocations();
      return (
        <button
          data-testid="seed-bound"
          onClick={() => {
            const created = addShootingLocation({
              name: 'Bound',
              geometry: {
                type: 'points',
                points: [{ id: 'x', name: 'X', latitude: 9, longitude: 9 }]
              }
            });
            bindShootingLocation(created.id);
          }}
        />
      );
    }
    wrapper(
      <>
        <BoundLocation />
        <SaveShootingLocationControl area={pointsArea} />
      </>
    );

    fireEvent.click(screen.getByTestId('seed-bound'));
    await waitFor(() => {
      expect(screen.getByTestId('save-shooting-location-changes')).toBeTruthy();
      expect(screen.getByTestId('saved-location-dirty')).toBeTruthy();
    });
  });
});

describe('SaveSetupControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a target, location, and setup on save', async () => {
    const onGoToSavedLocations = vi.fn();
    wrapper(<SaveSetupControl target={target} landmarkName="Landmark" area={pathArea} onGoToSavedLocations={onGoToSavedLocations} />);

    expect(screen.getByTestId('save-setup-button')).toBeTruthy();
    fireEvent.click(screen.getByTestId('save-setup-button'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-setup-button').textContent).toMatch(/Setup saved ✓/);
    });
    expect(screen.getByTestId('saved-setup-button').textContent).toMatch(/Landmark/);
  });

  it('keeps showing saved state while inputs are unchanged and opens Saved locations', async () => {
    const onGoToSavedLocations = vi.fn();
    wrapper(<SaveSetupControl target={target} landmarkName={null} area={pointsArea} onGoToSavedLocations={onGoToSavedLocations} />);

    fireEvent.click(screen.getByTestId('save-setup-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-setup-button')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('view-saved-locations'));
    expect(onGoToSavedLocations).toHaveBeenCalledTimes(1);
  });

  it('does not create duplicate targets when the coordinates already match', async () => {
    function Seed() {
      const { addTarget, bindTarget } = useSavedLocations();
      return (
        <button
          data-testid="seed"
          onClick={() => {
            const created = addTarget({ name: 'Tower', latitude: 1.31, longitude: 103.88 });
            bindTarget(created.id);
          }}
        />
      );
    }
    wrapper(
      <>
        <Seed />
        <SaveSetupControl target={target} landmarkName={null} area={pathArea} />
      </>
    );

    fireEvent.click(screen.getByTestId('seed'));
    await waitFor(() => {
      expect(screen.getByTestId('save-setup-button')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('save-setup-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-setup-button').textContent).toMatch(/Tower/);
    });
  });
});
