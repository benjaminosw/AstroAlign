import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CalendarProvider } from '../../lib/calendar/CalendarProvider';
import { SavedLocationsProvider, useSavedLocations } from '../../lib/saved/savedState';
import type { SaveAlignmentInput } from '../../lib/saved/types';
import SavedAlignmentsPage from '../SavedAlignmentsPage';

let lastId = '';

function makeInput(date: string, time: string): SaveAlignmentInput {
  return {
    source: 'finder',
    object: 'Sun',
    event: 'rise',
    date,
    time,
    timeZone: 'UTC',
    celestialAzimuth: 90,
    targetBearing: 89.5,
    alignmentError: 0.5,
    toleranceDegrees: 1,
    withinTolerance: true,
    targetId: null,
    shootingSetupId: null,
    observerSnapshot: null,
    targetSnapshot: null,
    shootingPositionSnapshot: null,
    shootingLocationSnapshot: null
  };
}

function Harness() {
  const { addSavedAlignment, setSavedAlignmentCalendarIntegration, savedAlignments } = useSavedLocations();
  return (
    <div>
      <button
        data-testid="add-past"
        onClick={() => {
          lastId = addSavedAlignment(makeInput('2020-01-01', '00:00:00')).id;
        }}
      />
      <button
        data-testid="add-upcoming-a"
        onClick={() => {
          lastId = addSavedAlignment(makeInput('2099-01-01', '00:00:00')).id;
        }}
      />
      <button
        data-testid="add-upcoming-b"
        onClick={() => {
          lastId = addSavedAlignment(makeInput('2099-01-01', '12:00:00')).id;
        }}
      />
      <button
        data-testid="add-with-integration"
        onClick={() => {
          lastId = addSavedAlignment(makeInput('2099-06-01', '07:00:00')).id;
        }}
      />
      <button
        data-testid="set-google-integration"
        onClick={() => {
          setSavedAlignmentCalendarIntegration(lastId, 'google', {
            calendarId: 'primary',
            eventId: 'evt-1',
            eventUrl: null,
            lastSyncedAt: new Date().toISOString()
          });
        }}
      />
      <span data-testid="last-id">{lastId}</span>
      <span data-testid="saved-count">{savedAlignments.length}</span>
      <SavedAlignmentsPage />
    </div>
  );
}

function renderPage() {
  return render(
    <CalendarProvider>
      <SavedLocationsProvider>
        <Harness />
      </SavedLocationsProvider>
    </CalendarProvider>
  );
}

describe('SavedAlignmentsPage', () => {
  beforeEach(() => {
    lastId = '';
  });

  it('shows the empty state when no alignments are saved', () => {
    renderPage();
    expect(screen.getByTestId('saved-alignments-page')).toBeTruthy();
    expect(screen.getByText(/No saved alignments yet/)).toBeTruthy();
  });

  it('sorts newest first and filters by upcoming and past with counts', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('add-past'));
    fireEvent.click(screen.getByTestId('add-upcoming-a'));
    fireEvent.click(screen.getByTestId('add-upcoming-b'));

    await waitFor(() => {
      expect(screen.getAllByTestId(/^saved-alignment-card-/)).toHaveLength(3);
    });

    expect(screen.getByTestId('alignments-filter-all').textContent).toBe('All (3)');
    expect(screen.getByTestId('alignments-filter-upcoming').textContent).toBe('Upcoming (2)');
    expect(screen.getByTestId('alignments-filter-past').textContent).toBe('Past (1)');

    const cards = screen.getAllByTestId(/^saved-alignment-card-/);
    expect(cards[0].textContent).toContain('12:00:00');
    expect(cards[1].textContent).toContain('2099-01-01');
    expect(cards[2].textContent).toContain('2020-01-01');

    fireEvent.click(screen.getByTestId('alignments-filter-upcoming'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^saved-alignment-card-/)).toHaveLength(2);
    });

    fireEvent.click(screen.getByTestId('alignments-filter-past'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^saved-alignment-card-/)).toHaveLength(1);
    });
    expect(screen.getByTestId('last-id').textContent ? screen.getAllByTestId(/^saved-alignment-card-/)[0].textContent : '').toContain(
      '2020-01-01'
    );
  });

  it('deletes an alignment through the confirmation panel', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('add-past'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('1');
    });

    const id = screen.getByTestId('last-id').textContent;
    fireEvent.click(screen.getByTestId(`saved-alignment-delete-${id}`));
    expect(screen.getByTestId('delete-alignment-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('confirm-delete-alignment'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('0');
    });
    expect(screen.getByTestId('saved-alignments-notice').textContent).toContain('Deleted saved alignment');
  });

  it('removes the event from the calendar when the checkbox is checked', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.includes('/api/calendar/')
        ? { calendars: [] }
        : { connected: false, accountEmail: null };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.click(screen.getByTestId('add-with-integration'));
    fireEvent.click(screen.getByTestId('set-google-integration'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('1');
    });

    const id = screen.getByTestId('last-id').textContent;
    fireEvent.click(screen.getByTestId(`saved-alignment-delete-${id}`));

    const checkbox = screen.getByTestId('delete-remove-from-calendar');
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    expect(screen.getByTestId('confirm-delete-alignment').textContent).toBe('Delete and remove from calendar');

    fireEvent.click(screen.getByTestId('confirm-delete-alignment'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('0');
    });

    const deleteCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/calendar/google/events'));
    expect(deleteCall).toBeTruthy();
    expect(String(deleteCall?.[0])).toContain('calendarId=primary&eventId=evt-1');
  });

  it('aborts the deletion and keeps the alignment when removing the event fails', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
      const url = String(input);
      if (url.includes('/api/calendar/') && init?.method === 'DELETE') {
        return { ok: false, status: 404, json: async () => ({ error: 'Event not found' }) } as unknown as Response;
      }
      const body = url.includes('/api/calendar/')
        ? { calendars: [] }
        : { connected: false, accountEmail: null };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.click(screen.getByTestId('add-with-integration'));
    fireEvent.click(screen.getByTestId('set-google-integration'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('1');
    });

    const id = screen.getByTestId('last-id').textContent;
    fireEvent.click(screen.getByTestId(`saved-alignment-delete-${id}`));
    fireEvent.click(screen.getByTestId('delete-remove-from-calendar'));
    fireEvent.click(screen.getByTestId('confirm-delete-alignment'));

    await waitFor(() => {
      const notice = screen.getByTestId('saved-alignments-notice');
      expect(notice.textContent).toContain('Could not remove the event from Google Calendar');
      expect(notice.textContent).toContain('The alignment was not deleted');
    });
    expect(screen.getByTestId('saved-count').textContent).toBe('1');
  });
});
