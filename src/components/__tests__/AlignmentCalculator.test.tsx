import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AlignmentCalculator from '../AlignmentCalculator';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';
import type { SelectedLandmark } from '../../lib/geocoding/types';

vi.mock('../../lib/geocoding/index', () => ({
  activeGeocoder: { search: vi.fn() }
}));

import { activeGeocoder } from '../../lib/geocoding/index';

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [landmark, setLandmark] = useState<SelectedLandmark | null>(null);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <AlignmentCalculator
      observer={observer}
      target={target}
      landmark={landmark}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      observerCoordinateError={observerCoordinateError}
      onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
      onSelectLandmark={(selected) => {
        setLandmark(selected);
        setTarget((prev) => ({ ...prev, latitude: selected.latitude, longitude: selected.longitude }));
      }}
      onClearLandmark={() => setLandmark(null)}
    />
  );
}

function calculateButton() {
  return screen.getByRole('button', { name: /calculate alignment/i });
}

function calculatedButton() {
  return screen.queryByRole('button', { name: /calculated/i });
}

describe('AlignmentCalculator workspace', () => {
  it('starts in needs-calculation state with a bright action button and placeholder results', () => {
    render(<Harness />);

    const button = calculateButton();
    expect(button.className).toContain('bg-sky-500');
    expect(calculatedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();

    expect(screen.getAllByLabelText('Latitude')).toHaveLength(2);
    expect(screen.getByLabelText('Date')).toBeTruthy();
  });

  it('shows results beside the inputs, flips the button, and keeps inputs editable after a calculation', () => {
    render(<Harness />);

    fireEvent.click(calculateButton());

    expect(calculatedButton()?.className).toContain('bg-slate-700');
    expect(screen.getByText('Alignment result')).toBeTruthy();
    expect(screen.getByText(/(within|outside) .*° tolerance/i)).toBeTruthy();
    expect(screen.queryByText('Results will appear here after you calculate.')).toBeNull();

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } });
    expect(dateInput.value).toBe('2026-08-20');
  });

  it('marks inputs as changed and shows a stale indicator while keeping the previous result visible', () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });

    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText('Alignment result')).toBeTruthy();
    expect(screen.queryByText(/1 Jan 2030/)).toBeNull();
  });

  it('marks inputs as changed for object, time, tolerance, and coordinate edits', async () => {
    render(<Harness />);

    async function recalcThenChange(change: () => void) {
      fireEvent.click(screen.getByRole('button', { name: /calculate|calculated/i }));
      await screen.findByRole('button', { name: /calculated/i });
      change();
      expect(calculatedButton()).toBeNull();
      expect(calculateButton()).toBeTruthy();
    }

    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Astronomical object'), { target: { value: 'Moon' } })
    );
    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-16' } })
    );
    await recalcThenChange(() => fireEvent.click(screen.getByLabelText('Increase hour')));
    await recalcThenChange(() =>
      fireEvent.change(screen.getByLabelText('Alignment tolerance'), { target: { value: '1' } })
    );
    await recalcThenChange(() =>
      fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '1.5' } })
    );
  });

  it('updates the result on recalculate and clears the stale indicator', () => {
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2030-01-01' } });
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();

    fireEvent.click(calculateButton());

    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(calculatedButton()).toBeTruthy();
    expect(screen.getByText(/1 Jan 2030/)).toBeTruthy();
  });

  it('shows an error and does not mark inputs as calculated when calculation fails', () => {
    render(<Harness />);

    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '200' } });
    fireEvent.click(calculateButton());

    expect(screen.getAllByText(/latitude must be between/i).length).toBeGreaterThan(0);
    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText('Results will appear here after you calculate.')).toBeTruthy();
  });

  it('uses a three-column desktop layout with coordinates, settings, then results', () => {
    render(<Harness />);

    const workspace = screen.getByTestId('calculator-workspace');
    expect(workspace.className).toContain('lg:grid-cols-[');

    const columns = Array.from(workspace.children) as HTMLElement[];
    expect(columns).toHaveLength(3);
    expect(within(columns[0]).getByText('Observer')).toBeTruthy();
    expect(columns[0].className).toContain('lg:sticky');
    expect(within(columns[1]).getByText('Alignment')).toBeTruthy();
    expect(columns[1].className).toContain('lg:sticky');
    expect(within(columns[2]).getByText('Alignment result')).toBeTruthy();
  });

  it('marks the calculation as stale when a landmark is selected', async () => {
    vi.useFakeTimers();
    vi.mocked(activeGeocoder.search).mockResolvedValue([
      { id: 'mbs', name: 'Marina Bay Sands', locality: 'Singapore', country: 'Singapore', latitude: 1.2834, longitude: 103.8607 }
    ]);
    render(<Harness />);

    fireEvent.click(calculateButton());
    expect(calculatedButton()).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search for a landmark...'), { target: { value: 'Marina Bay Sands' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseDown(screen.getByText('Marina Bay Sands'));

    expect(calculatedButton()).toBeNull();
    expect(calculateButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByText('Marina Bay Sands')).toBeTruthy();
    vi.useRealTimers();
  });
});
