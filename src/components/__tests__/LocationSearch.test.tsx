import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LocationSearch from '../LocationSearch';
import { GeocodingError } from '../../lib/geocoding/types';
import type { LocationSearchResult } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

const MBS: LocationSearchResult = {
  id: 'mbs',
  name: 'Marina Bay Sands',
  formattedAddress: '10 Bayfront Avenue, Singapore 018956',
  latitude: 1.2834,
  longitude: 103.8607
};

const MARINA_BAY: LocationSearchResult = {
  id: 'mb',
  name: 'Marina Bay',
  formattedAddress: 'Marina Bay, Singapore',
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

function renderSearch() {
  render(<LocationSearch idPrefix="test" ariaLabel="Test location" placeholder="Search test..." onSelect={vi.fn()} />);
  return screen.getByRole('combobox', { name: /test location/i }) as HTMLInputElement;
}

describe('LocationSearch', () => {
  it('does not request for every keystroke and debounces to the final query', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    const input = renderSearch();

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

  it('shows the formatted address under each result', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    renderSearch();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText('10 Bayfront Avenue, Singapore 018956')).toBeTruthy();
  });

  it('selecting a result calls onSelect and clears the input', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS, MARINA_BAY]);
    const onSelect = vi.fn();

    render(<LocationSearch idPrefix="test" ariaLabel="Test location" placeholder="Search test..." onSelect={onSelect} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(onSelect).toHaveBeenCalledWith(MBS);
    expect(input.value).toBe('');
  });

  it('does not auto-select the first result', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS, MARINA_BAY]);
    const onSelect = vi.fn();

    render(<LocationSearch idPrefix="test" ariaLabel="Test location" placeholder="Search test..." onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Marina Bay' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows a no-results message', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([]);
    renderSearch();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Nowhereville' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/no locations found/i)).toBeTruthy();
  });

  it('shows a friendly error message without auto-selecting anything', async () => {
    vi.mocked(activeGeocoder.search).mockRejectedValue(new GeocodingError('boom', 'network'));
    renderSearch();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Marina' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText(/unable to search for this location/i)).toBeTruthy();
  });

  it('shows a loading indicator while searching without blocking the rest of the form', async () => {
    let resolveSearch: ((_results: LocationSearchResult[]) => void) | null = null;
    vi.mocked(activeGeocoder.search).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderSearch();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Marina' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByText('Searching…')).toBeTruthy();
    expect(screen.getByTestId('location-search-loading')).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();

    await act(async () => {
      resolveSearch?.([MBS]);
    });

    expect(screen.queryByText('Searching…')).toBeNull();
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
  });

  it('performs an immediate search when Enter is pressed', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    const input = renderSearch();

    fireEvent.change(input, { target: { value: 'Marina Bay Sands' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(activeGeocoder.search).toHaveBeenCalledTimes(1);
    expect(activeGeocoder.search).toHaveBeenCalledWith('Marina Bay Sands', expect.anything());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(activeGeocoder.search).toHaveBeenCalledTimes(1);
  });

  it('performs an immediate search when the search button is clicked', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS]);
    renderSearch();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /search test location/i }));
    });

    expect(activeGeocoder.search).toHaveBeenCalledTimes(1);
    expect(activeGeocoder.search).toHaveBeenCalledWith('Marina Bay Sands', expect.anything());
  });

  it('selects a highlighted result with the keyboard and clears the input', async () => {
    vi.mocked(activeGeocoder.search).mockResolvedValue([MBS, MARINA_BAY]);
    const onSelect = vi.fn();

    render(<LocationSearch idPrefix="test" ariaLabel="Test location" placeholder="Search test..." onSelect={onSelect} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Marina Bay' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(MBS);
    expect(input.value).toBe('');
  });
});
