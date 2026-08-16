import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { CalendarProvider, useCalendar } from '../../lib/calendar/CalendarProvider';
import { SavedLocationsProvider, useSavedLocations } from '../../lib/saved/savedState';
import type { SaveAlignmentInput } from '../../lib/saved/types';
import SaveAllControl from '../SaveAllControl';
import type { SaveAllItem } from '../SaveAllControl';

function item(time: string, name: string, bearing: number): SaveAllItem {
  const input: SaveAlignmentInput = {
    source: 'finder',
    object: 'Sun',
    event: 'rise',
    date: '2027-08-01',
    time,
    timeZone: 'UTC',
    celestialAzimuth: 90,
    targetBearing: bearing,
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
  return { input, targetName: `Tower ${name}`, name };
}

function Harness({ items, onGoToSettings }: { items: SaveAllItem[]; onGoToSettings: () => void }) {
  const { refreshCalendars } = useCalendar();
  const { savedAlignments } = useSavedLocations();
  useEffect(() => {
    void refreshCalendars('google');
  }, [refreshCalendars]);
  return (
    <div>
      <SaveAllControl items={items} onGoToSettings={onGoToSettings} />
      <span data-testid="saved-count">{savedAlignments.length}</span>
      <span data-testid="google-integration">{savedAlignments[0]?.calendarIntegrations?.google?.eventId ?? 'none'}</span>
    </div>
  );
}

function renderControl(items: SaveAllItem[], onGoToSettings: () => void = () => {}) {
  return render(
    <CalendarProvider>
      <SavedLocationsProvider>
        <Harness items={items} onGoToSettings={onGoToSettings} />
      </SavedLocationsProvider>
    </CalendarProvider>
  );
}

const ALL_ITEMS = [item('07:00:00', 'A', 89.5), item('07:05:00', 'B', 89.6)];

type FetchHandler = (_url: string, _init?: Parameters<typeof fetch>[1]) => Response;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const defaultFetchHandler: FetchHandler = (url, init) => {
  if (url.includes('/api/auth/google/status')) {
    return jsonResponse({ connected: true, accountEmail: 'a@example.com' });
  }
  if (url.includes('/api/auth/microsoft/status')) {
    return jsonResponse({ connected: false, accountEmail: null });
  }
  if (url.includes('/api/calendar/google/calendars')) {
    return jsonResponse({ calendars: [{ id: 'primary', summary: 'Primary' }] });
  }
  if (url.includes('/api/calendar/google/events') && init?.method === 'POST') {
    const body = JSON.parse(String(init.body)) as { request: { calendarId: string } };
    return jsonResponse({ calendarId: body.request.calendarId, eventId: 'evt-' + Date.now(), eventUrl: null });
  }
  return jsonResponse({ error: 'Unexpected request' }, 500);
};

describe('SaveAllControl', () => {
  let handler: FetchHandler;

  beforeEach(() => {
    handler = defaultFetchHandler;
    const fetchMock = vi.fn(async (input: string | URL, init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input.toString();
      return handler(url, init as Parameters<typeof fetch>[1]);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when there are no items', () => {
    renderControl([]);
    expect(screen.queryByTestId('save-all-button')).toBeNull();
  });

  it('saves all visible alignments once and skips in-batch duplicates', async () => {
    renderControl(ALL_ITEMS);

    const saveButton = screen.getByTestId('save-all-button');
    expect(saveButton.textContent).toContain('Save all (2)');

    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('2');
      expect(screen.getByTestId('save-all-notice').textContent).toBe('Saved 2 of 2 visible alignments.');
    });

    expect(saveButton.textContent).toContain('All visible saved ✓');
  });

  it('deduplicates identical items within a batch', async () => {
    const first = item('07:00:00', 'A', 89.5);
    const second = item('07:00:00', 'A', 89.5);
    renderControl([first, second]);

    fireEvent.click(screen.getByTestId('save-all-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('1');
    });
    expect(screen.getByTestId('save-all-notice').textContent).toBe('Saved 1 of 2 visible alignment.');
  });

  it('shows the connect button and forwards to settings when no calendar is connected', async () => {
    handler = (url) => {
      if (url.includes('status')) {
        return jsonResponse({ connected: false, accountEmail: null });
      }
      return defaultFetchHandler(url);
    };
    const onGoToSettings = vi.fn();
    renderControl(ALL_ITEMS, onGoToSettings);

    await waitFor(() => {
      expect(screen.getByTestId('connect-calendar-button')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('connect-calendar-button'));
    expect(onGoToSettings).toHaveBeenCalled();
  });

  it('adds all saved alignments to the connected calendar and records the integration', async () => {
    renderControl(ALL_ITEMS);
    fireEvent.click(screen.getByTestId('save-all-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('2');
    });

    const addAllButton = screen.getByTestId('add-all-to-calendar-button');
    expect(addAllButton.textContent).toContain('Google Calendar');
    fireEvent.click(addAllButton);

    await waitFor(() => {
      expect(screen.getByTestId('google-integration').textContent).not.toBe('none');
      expect(screen.getByTestId('save-all-notice').textContent).toBe('All 2 added to Google Calendar.');
    });
  });

  it('reports partial failures and retries the failed additions', async () => {
    let eventsPosted = 0;
    handler = (url, init) => {
      if (url.includes('/api/calendar/google/events') && init?.method === 'POST') {
        eventsPosted += 1;
        if (eventsPosted === 1) {
          return jsonResponse({ error: 'Quota exceeded' }, 429);
        }
        const body = JSON.parse(String(init.body)) as { request: { calendarId: string } };
        return jsonResponse({ calendarId: body.request.calendarId, eventId: 'evt-retry', eventUrl: null });
      }
      return defaultFetchHandler(url, init);
    };

    renderControl(ALL_ITEMS);
    fireEvent.click(screen.getByTestId('save-all-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('2');
    });

    await waitFor(() => {
      expect(screen.getByTestId('add-all-to-calendar-button')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('add-all-to-calendar-button'));
    await waitFor(() => {
      expect(screen.getByTestId('save-all-notice').textContent).toBe('1 added to Google Calendar. 1 could not be added.');
    });
    const retry = screen.getByTestId('retry-calendar-button');
    expect(retry.textContent).toContain('Retry (1)');

    fireEvent.click(retry);
    await waitFor(() => {
      expect(screen.getByTestId('google-integration').textContent).not.toBe('none');
      expect(screen.getByTestId('save-all-notice').textContent).toBe('1 added to Google Calendar.');
    });
    expect(screen.queryByTestId('retry-calendar-button')).toBeNull();
  });

  it('errors when a provider is connected but no calendar is available', async () => {
    handler = (url) => {
      if (url.includes('/api/calendar/google/calendars')) {
        return jsonResponse({ calendars: [] });
      }
      return defaultFetchHandler(url);
    };

    renderControl(ALL_ITEMS);
    fireEvent.click(screen.getByTestId('save-all-button'));
    await waitFor(() => {
      expect(screen.getByTestId('saved-count').textContent).toBe('2');
    });

    await waitFor(() => {
      expect(screen.getByTestId('add-all-to-calendar-button')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('add-all-to-calendar-button'));
    await waitFor(() => {
      expect(screen.getByTestId('save-all-error').textContent).toBe('Choose a Google calendar in Settings first.');
    });
  });
});
