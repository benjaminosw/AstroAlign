import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LandmarkSearch from '../LandmarkSearch';
import { GeocodingError } from '../../lib/geocoding/types';
import type { GeocodingResult } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

const MBS: GeocodingResult = {
  id: 'mbs',
  name: 'Marina Bay Sands',
  locality: 'Singapore',
  country: 'Singapore',
  latitude: 1.2834,
  longitude: 103.8607
};

const MARINA_BAY: GeocodingResult = {
  id: 'mb',
  name: 'Marina Bay',
  locality: 'Singapore',
  country: 'Singapore',
  latitude: 1.279,
  longitude: 103.855
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function searchInput() {
  return screen.getByRole('combobox', { name: /landmark/i }) as HTMLInputElement;
}

describe('LandmarkSearch', () => {
  it('does not request for every keystroke and debounces to the final query', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    render(<LandmarkSearch onSelect={vi.fn()} />);
    const input = searchInput();

    fireEvent.change(input, { target: { value: 'M' } });
    await act(async () => {});
    fireEvent.change(input, { target: { value: 'Ma' } });
    await act(async () => {});
    fireEvent.change(input, { target: { value: 'Mar' } });
    await act(async () => {});
    fireEvent.change(input, { target: { value: 'Marina' } });

    expect(activeGeocoder.search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(activeGeocoder.search).toHaveBeenCalledTimes(1);
    expect(activeGeocoder.search).toHaveBeenCalledWith('Marina', expect.anything());
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
  });

  it('selecting a result calls onSelect and clears the input', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS, MARINA_BAY]);
    const onSelect = vi.fn();

    render(<LandmarkSearch onSelect={onSelect} />);
    fireEvent.change(searchInput(), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(onSelect).toHaveBeenCalledWith(MBS);
    expect(searchInput().value).toBe('');
  });

  it('shows a no-results message', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([]);
    render(<LandmarkSearch onSelect={vi.fn()} />);

    fireEvent.change(searchInput(), { target: { value: 'Nowhereville' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/no landmarks found/i)).toBeTruthy();
  });

  it('shows a friendly network error message', async () => {
    vi.mocked(activeGeocoder.search).mockRejectedValue(
      new GeocodingError('Unable to search for landmarks. Check your connection and try again.', 'network')
    );
    render(<LandmarkSearch onSelect={vi.fn()} />);

    fireEvent.change(searchInput(), { target: { value: 'Marina' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/unable to search for landmarks/i)).toBeTruthy();
  });

  it('shows a loading indicator while searching without blocking the rest of the form', async () => {
    let resolveSearch: ((_results: GeocodingResult[]) => void) | null = null;
    vi.mocked(activeGeocoder.search).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    render(<LandmarkSearch onSelect={vi.fn()} />);

    fireEvent.change(searchInput(), { target: { value: 'Marina' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByText('Searching…')).toBeTruthy();
    expect(searchInput()).toBeTruthy();

    await act(async () => {
      resolveSearch?.([MBS]);
    });

    expect(screen.queryByText('Searching…')).toBeNull();
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
  });
});
