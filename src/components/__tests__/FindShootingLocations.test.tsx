import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FindShootingLocations from '../FindShootingLocations';
import { DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';

vi.mock('../ShootingLocationMap', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map" />
}));

function Harness() {
  const [target, setTarget] = useState(DEFAULT_TARGET);
  return (
    <FindShootingLocations
      target={target}
      targetCoordinateError={null}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
    />
  );
}

function findButton() {
  return screen.getByRole('button', { name: /find locations/i });
}

describe('FindShootingLocations workspace', () => {
  it('starts with the reverse search form and placeholder results', () => {
    render(<Harness />);

    expect(screen.getByLabelText('Latitude')).toBeTruthy();
    expect(screen.getByLabelText('Longitude')).toBeTruthy();
    expect(screen.getByLabelText('Date')).toBeTruthy();
    expect(screen.getByLabelText('Object')).toBeTruthy();
    expect(screen.getByLabelText('Event')).toBeTruthy();
    expect(screen.getByLabelText('Search radius')).toBeTruthy();
    expect(screen.getByLabelText('Alignment tolerance')).toBeTruthy();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
    expect(screen.getByText(/geometric alignment only/i)).toBeTruthy();
  });

  it('shows the Moon phase filter only when Moon is selected', () => {
    render(<Harness />);

    expect(screen.queryByLabelText('Moon phase')).toBeNull();
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });
    expect(screen.getByLabelText('Moon phase')).toBeTruthy();
  });

  it('runs a search and displays ranked potential locations', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-08-17' } });
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Sun' } });
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'rise' } });
    fireEvent.click(findButton());

    const heading = await screen.findByText(/potential locations/i, {}, { timeout: 5000 });
    expect(heading.textContent).toMatch(/\d+ potential locations/);
    expect(screen.queryByText('Results will appear here after you search.')).toBeNull();
    expect(screen.getByRole('button', { name: /searched/i })).toBeTruthy();
    expect(await screen.findByTestId('mock-map', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('marks results as stale when inputs change after a search', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-08-17' } });
    fireEvent.click(findButton());
    await screen.findByText(/potential locations/i, {}, { timeout: 5000 });

    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'set' } });

    expect(screen.queryByRole('button', { name: /searched/i })).toBeNull();
    expect(findButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
  });

  it('reports an error when the event does not exist and returns no candidates', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-06-21' } });
    fireEvent.change(screen.getAllByLabelText('Latitude')[0], { target: { value: '78.22' } });
    fireEvent.change(screen.getAllByLabelText('Longitude')[0], { target: { value: '15.63' } });

    fireEvent.click(findButton());

    await waitFor(() => {
      expect(screen.getByText(/no valid rise event/i)).toBeTruthy();
    });
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
  });
});
