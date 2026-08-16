import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SavedLocationsProvider, useSavedLocations } from '../savedState';
import { AppStateProvider, useAppState } from '../../storage/appState';
import { loadAllData } from '../../storage/repository';
import { calendarSyncStatus } from '../../calendar/types';

function HydratedHarness({ children }: { children: ReactNode }) {
  const { isHydrated } = useAppState();
  if (!isHydrated) {
    return null;
  }
  return <SavedLocationsProvider>{children}</SavedLocationsProvider>;
}

function IntegrationProbe() {
  const value = useSavedLocations();
  const alignment = value.savedAlignments[0];
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
        onClick={() => {
          if (!alignment) {
            return;
          }
          value.setSavedAlignmentCalendarIntegration(alignment.id, 'google', {
            calendarId: 'primary',
            eventId: 'evt-1',
            eventUrl: 'https://calendar.google.com/event?eid=1',
            lastSyncedAt: new Date().toISOString()
          });
        }}
        data-testid="set-google"
      />
      <button
        onClick={() => {
          if (!alignment) {
            return;
          }
          value.setSavedAlignmentCalendarIntegration(alignment.id, 'microsoft', {
            calendarId: 'cal-2',
            eventId: 'evt-2',
            eventUrl: null,
            lastSyncedAt: new Date().toISOString()
          });
        }}
        data-testid="set-microsoft"
      />
      <button
        onClick={() => {
          if (!alignment) {
            return;
          }
          value.setSavedAlignmentCalendarIntegration(alignment.id, 'google', null);
        }}
        data-testid="clear-google"
      />
      <span data-testid="google-event">{alignment?.calendarIntegrations?.google?.eventId ?? 'none'}</span>
      <span data-testid="microsoft-event">{alignment?.calendarIntegrations?.microsoft?.eventId ?? 'none'}</span>
      <span data-testid="google-status">{alignment ? calendarSyncStatus(alignment, 'google', true) : 'none'}</span>
    </div>
  );
}

describe('saved alignment calendar integrations', () => {
  it('stores and clears integration entries per provider without marking the alignment out-of-sync', async () => {
    render(
      <SavedLocationsProvider>
        <IntegrationProbe />
      </SavedLocationsProvider>
    );

    fireEvent.click(screen.getByTestId('save-alignment'));
    await waitFor(() => {
      expect(screen.getByTestId('google-event').textContent).toBe('none');
    });

    fireEvent.click(screen.getByTestId('set-google'));
    await waitFor(() => {
      expect(screen.getByTestId('google-event').textContent).toBe('evt-1');
      expect(screen.getByTestId('microsoft-event').textContent).toBe('none');
      expect(screen.getByTestId('google-status').textContent).toBe('exported');
    });

    fireEvent.click(screen.getByTestId('set-microsoft'));
    await waitFor(() => {
      expect(screen.getByTestId('microsoft-event').textContent).toBe('evt-2');
    });

    fireEvent.click(screen.getByTestId('clear-google'));
    await waitFor(() => {
      expect(screen.getByTestId('google-event').textContent).toBe('none');
      expect(screen.getByTestId('microsoft-event').textContent).toBe('evt-2');
      expect(screen.getByTestId('google-status').textContent).toBe('not-exported');
    });
  });

  it('persists calendar integrations and reloads them on a fresh provider', async () => {
    const first = render(
      <AppStateProvider>
        <HydratedHarness>
          <IntegrationProbe />
        </HydratedHarness>
      </AppStateProvider>
    );
    fireEvent.click(await screen.findByTestId('save-alignment'));
    await waitFor(async () => {
      const data = await loadAllData();
      expect(data.savedAlignments).toHaveLength(1);
    });
    fireEvent.click(screen.getByTestId('set-google'));
    await waitFor(() => {
      expect(screen.getByTestId('google-event').textContent).toBe('evt-1');
    });

    await waitFor(async () => {
      const data = await loadAllData();
      expect(data.savedAlignments[0]?.calendarIntegrations?.google?.eventId).toBe('evt-1');
    });

    first.unmount();

    render(
      <AppStateProvider>
        <HydratedHarness>
          <IntegrationProbe />
        </HydratedHarness>
      </AppStateProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('google-event').textContent).toBe('evt-1');
    });
  });
});
