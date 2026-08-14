import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AlignmentFinder from '../AlignmentFinder';
import { DEFAULT_OBSERVER, DEFAULT_TARGET } from '../../lib/constants/defaultCoordinates';
import { validateCoordinates } from '../../lib/timezone/validateCoordinates';

function Harness() {
  const [observer, setObserver] = useState(DEFAULT_OBSERVER);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const observerCoordinateError = validateCoordinates(observer.latitude, observer.longitude);

  return (
    <AlignmentFinder
      observer={observer}
      target={target}
      timeZone="Asia/Singapore"
      timeZoneStatus="idle"
      observerCoordinateError={observerCoordinateError}
      onObserverChange={(field, value) => setObserver((prev) => ({ ...prev, [field]: Number(value) }))}
      onTargetChange={(field, value) => setTarget((prev) => ({ ...prev, [field]: Number(value) }))}
    />
  );
}

function findButton() {
  return screen.getByRole('button', { name: /find alignments/i });
}

function searchedButton() {
  return screen.queryByRole('button', { name: /searched/i });
}

describe('AlignmentFinder workspace', () => {
  it('starts in needs-search state with a bright button and placeholder results', () => {
    render(<Harness />);

    const button = findButton();
    expect(button.className).toContain('bg-emerald-500');
    expect(searchedButton()).toBeNull();
    expect(screen.getByText('Results will appear here after you search.')).toBeTruthy();
  });

  it('shows results and marks inputs as searched after a search', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());

    const found = await screen.findByText(/\d alignments? found/i, {}, { timeout: 5000 });
    expect(found.textContent).toMatch(/[1-9]\d* alignments? found/);
    expect(searchedButton()?.className).toContain('bg-slate-700');
    expect(screen.queryByText(/inputs changed/i)).toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('marks inputs as changed after a search while keeping the previous results visible', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Show only matches within tolerance'));
    fireEvent.click(findButton());
    await screen.findByText(/\d alignments? found/i, {}, { timeout: 5000 });

    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'Moon' } });

    expect(searchedButton()).toBeNull();
    expect(findButton()).toBeTruthy();
    expect(screen.getByText(/inputs changed/i)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('uses a three-column desktop layout with coordinates, settings, then results', () => {
    render(<Harness />);

    const workspace = screen.getByTestId('finder-workspace');
    expect(workspace.className).toContain('lg:grid-cols-[');

    const columns = Array.from(workspace.children) as HTMLElement[];
    expect(columns).toHaveLength(3);
    expect(within(columns[0]).getByText('Observer')).toBeTruthy();
    expect(columns[0].className).toContain('lg:sticky');
    expect(within(columns[1]).getByText('Search')).toBeTruthy();
    expect(columns[1].className).toContain('lg:sticky');
    expect(within(columns[2]).getByText('Search results')).toBeTruthy();
  });
});
