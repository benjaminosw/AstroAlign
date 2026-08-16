import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SavedLocationsProvider } from '../../lib/saved/savedState';
import { CalendarProvider } from '../../lib/calendar/CalendarProvider';
import type { SavedSetup, SavedShootingLocation, SavedTarget } from '../../lib/saved/types';
import { saveSetup, saveShootingLocation, saveTarget } from '../../lib/storage/repository';
import { AppStateProvider, useAppState } from '../../lib/storage/appState';
import SavedLocationsPage from '../SavedLocationsPage';

vi.mock('../SavedLocationMap', () => ({
  __esModule: true,
  default: (props: {
    target?: { latitude: number; longitude: number; name?: string | null } | null;
    shootingLocation?: { geometry: { type: string }; name?: string | null } | null;
    editable?: boolean;
    onMarkerMove?: (_markerId: string, _lat: number, _lng: number) => void;
    fitId?: number;
  }) => (
    <div
      data-testid="mock-saved-locations-map"
      data-target-lat={props.target?.latitude ?? ''}
      data-target-lon={props.target?.longitude ?? ''}
      data-location-type={props.shootingLocation?.geometry?.type ?? ''}
      data-editable={props.editable ? 'true' : 'false'}
      data-fit-id={props.fitId ?? ''}
    />
  )
}));

const target = {
  id: 'target-1',
  name: 'Tower A',
  latitude: 1.31,
  longitude: 103.88,
  elevation: 12,
  notes: 'Roof access',
  createdAt: '2027-08-01T00:00:00.000Z',
  updatedAt: '2027-08-01T00:00:00.000Z'
};

const location = {
  id: 'location-1',
  name: 'East Coast Park',
  notes: '',
  createdAt: '2027-08-02T00:00:00.000Z',
  updatedAt: '2027-08-02T00:00:00.000Z',
  geometry: {
    type: 'path',
    start: { id: 's', name: 'Start', latitude: 1.3, longitude: 103.9 },
    end: { id: 'e', name: 'End', latitude: 1.4, longitude: 104.0 }
  }
};

const setup = {
  id: 'setup-1',
  name: 'Tower A · East Coast Park',
  targetId: 'target-1',
  shootingLocationId: 'location-1',
  createdAt: '2027-08-03T00:00:00.000Z',
  updatedAt: '2027-08-03T00:00:00.000Z'
};

async function seedDatabase() {
  await saveTarget(target as SavedTarget);
  await saveShootingLocation(location as SavedShootingLocation);
  await saveSetup(setup as SavedSetup);
}

function HydratedHarness({ children }: { children: ReactNode }) {
  const { isHydrated } = useAppState();
  if (!isHydrated) {
    return null;
  }
  return (
    <CalendarProvider>
      <SavedLocationsProvider>{children}</SavedLocationsProvider>
    </CalendarProvider>
  );
}

function renderPage() {
  const onOpenTarget = vi.fn();
  const onOpenSetup = vi.fn();
  const result = render(
    <AppStateProvider>
      <HydratedHarness>
        <SavedLocationsPage onOpenTarget={onOpenTarget} onOpenSetup={onOpenSetup} />
      </HydratedHarness>
    </AppStateProvider>
  );
  return { onOpenTarget, onOpenSetup, ...result };
}

describe('SavedLocationsPage', () => {
  it('shows empty states when nothing is saved', async () => {
    renderPage();

    expect(await screen.findByTestId('saved-locations-page')).toBeTruthy();
    expect(screen.getByTestId('saved-filter-all').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Nothing saved yet/i)).toBeTruthy();
    expect(screen.getByText(/No saved targets yet/i)).toBeTruthy();
    expect(screen.getByText(/No saved shooting locations yet/i)).toBeTruthy();
    expect(screen.getByText(/No saved setups yet/i)).toBeTruthy();
  });

  it('renders seeded targets, locations, and setups as cards', async () => {
    await seedDatabase();
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('saved-target-card-target-1')).toBeTruthy();
    });
    expect(screen.getByText('Tower A')).toBeTruthy();
    expect(screen.getByTestId('saved-location-card-location-1')).toBeTruthy();
    expect(screen.getByText('East Coast Park')).toBeTruthy();
    expect(screen.getByTestId('saved-setup-card-setup-1')).toBeTruthy();
    expect(screen.getByText(/Tower A · East Coast Park/)).toBeTruthy();
  });

  it('filters the card lists', async () => {
    await seedDatabase();
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('saved-target-card-target-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('saved-filter-targets'));
    expect(screen.queryByTestId('saved-location-card-location-1')).toBeNull();
    expect(screen.queryByTestId('saved-setup-card-setup-1')).toBeNull();
    expect(screen.getByTestId('saved-target-card-target-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('saved-filter-setups'));
    expect(screen.queryByTestId('saved-target-card-target-1')).toBeNull();
    expect(screen.getByTestId('saved-setup-card-setup-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('saved-filter-all'));
    expect(screen.getByTestId('saved-target-card-target-1')).toBeTruthy();
    expect(screen.getByTestId('saved-location-card-location-1')).toBeTruthy();
  });

  it('edits a target and persists the change', async () => {
    await seedDatabase();
    renderPage();

    const card = await screen.findByTestId('saved-target-card-target-1');

    fireEvent.click(within(card).getByTestId('saved-target-edit-target-1'));

    const nameInput = within(card).getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Renamed Tower' } });
    fireEvent.click(within(card).getByTestId('saved-target-save-target-1'));

    await waitFor(() => {
      expect(within(card).queryByText('Renamed Tower')).toBeTruthy();
    });
    expect(screen.getByText(/Saved target "Renamed Tower" updated/i)).toBeTruthy();
  });

  it('rejects editing a target with invalid coordinates', async () => {
    await seedDatabase();
    renderPage();

    const card = await screen.findByTestId('saved-target-card-target-1');
    fireEvent.click(within(card).getByTestId('saved-target-edit-target-1'));

    const latitudeInput = within(card).getByLabelText('Latitude');
    fireEvent.change(latitudeInput, { target: { value: '999' } });
    fireEvent.click(within(card).getByTestId('saved-target-save-target-1'));

    expect(await screen.findByText(/Latitude must be between/i)).toBeTruthy();
    expect((within(card).getByLabelText('Name') as HTMLInputElement).value).toBe('Tower A');
    expect(within(card).getByTestId('saved-target-save-target-1')).toBeTruthy();
    expect(screen.queryByTestId('saved-notice')).toBeNull();
  });

  it('deletes a target after confirmation and cascades setups', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await seedDatabase();
    renderPage();

    const card = await screen.findByTestId('saved-target-card-target-1');
    fireEvent.click(within(card).getByTestId('saved-target-delete-target-1'));

    await waitFor(() => {
      expect(screen.queryByTestId('saved-target-card-target-1')).toBeNull();
      expect(screen.queryByTestId('saved-setup-card-setup-1')).toBeNull();
    });
    expect(screen.getByText(/Deleted saved target "Tower A"/i)).toBeTruthy();
    expect(screen.getByTestId('saved-location-card-location-1')).toBeTruthy();
  });

  it('keeps items when deletion is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await seedDatabase();
    renderPage();

    const card = await screen.findByTestId('saved-target-card-target-1');
    fireEvent.click(within(card).getByTestId('saved-target-delete-target-1'));

    expect(screen.getByTestId('saved-target-card-target-1')).toBeTruthy();
    expect(screen.getByTestId('saved-setup-card-setup-1')).toBeTruthy();
  });

  it('creates a setup from a location via Use with target', async () => {
    await seedDatabase();
    renderPage();

    const locationCard = await screen.findByTestId('saved-location-card-location-1');
    fireEvent.click(within(locationCard).getByTestId('saved-location-use-location-1'));

    const panel = screen.getByTestId('use-with-target-panel');
    expect(panel).toBeTruthy();

    fireEvent.change(within(panel).getByLabelText('Select a saved target'), { target: { value: 'target-1' } });
    fireEvent.click(within(panel).getByTestId('use-with-target-create'));

    await waitFor(() => {
      expect(screen.getByText(/Setup "Tower A · East Coast Park" saved/i)).toBeTruthy();
    });
    expect(screen.getAllByTestId(/^saved-setup-card-/)).toHaveLength(2);
  });

  it('calls onOpenTarget from Find shooting opportunities', async () => {
    await seedDatabase();
    const { onOpenTarget } = renderPage();

    const card = await screen.findByTestId('saved-target-card-target-1');
    fireEvent.click(within(card).getByTestId('saved-target-find-target-1'));

    expect(onOpenTarget).toHaveBeenCalledTimes(1);
    expect(onOpenTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'target-1', name: 'Tower A' }));
  });

  it('calls onOpenSetup from a setup Open action', async () => {
    await seedDatabase();
    const { onOpenSetup } = renderPage();

    const card = await screen.findByTestId('saved-setup-card-setup-1');
    fireEvent.click(within(card).getByTestId('saved-setup-open-setup-1'));

    expect(onOpenSetup).toHaveBeenCalledTimes(1);
    expect(onOpenSetup).toHaveBeenCalledWith(expect.objectContaining({ id: 'setup-1' }));
  });
});
