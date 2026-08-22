import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CalendarExportControl from '../CalendarExportControl';
import type { CalendarAlignmentInfo } from '../../lib/calendar/types';

function info(date: string): CalendarAlignmentInfo {
  return {
    object: 'Moon',
    event: 'rise',
    date,
    time: '19:42:18',
    timeZone: 'Asia/Singapore',
    alignmentErrorDegrees: 0.12,
    targetName: 'Lighthouse',
    moonPhase: { name: 'Full Moon', emoji: '\u{1F315}', phaseAngle: 180, illuminationPercent: 99.8 }
  };
}

describe('CalendarExportControl', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar-test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a compact menu with Google Calendar and .ics options for one result', () => {
    render(<CalendarExportControl events={[info('2026-08-29')]} />);

    const trigger = screen.getByTestId('calendar-export');
    expect(trigger.textContent).toContain('Save to Calendar');
    expect(screen.queryByTestId('calendar-export-menu')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByTestId('calendar-export-menu')).toBeTruthy();
    expect(screen.getByTestId('calendar-export-preview-title').textContent).toContain(
      'Full Moon \u2014 Lighthouse Alignment'
    );

    const googleLink = screen.getByTestId('calendar-export-google') as HTMLAnchorElement;
    expect(googleLink.href).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(googleLink.getAttribute('target')).toBe('_blank');

    fireEvent.click(screen.getByTestId('calendar-export-ics'));
    expect(screen.getByTestId('calendar-export-status').textContent).toMatch(/Downloaded \.ics/);
    expect(screen.queryByTestId('calendar-export-menu')).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('offers only .ics for bulk export and explains why', () => {
    render(<CalendarExportControl events={[info('2026-08-29'), info('2026-09-02')]} triggerLabel="\u{1F4C5} Save All" />);

    fireEvent.click(screen.getByTestId('calendar-export'));
    expect(screen.queryByTestId('calendar-export-google')).toBeNull();
    expect(screen.getByTestId('calendar-export-ics').textContent).toContain('Download visible results');

    fireEvent.click(screen.getByTestId('calendar-export-ics'));
    expect(screen.getByTestId('calendar-export-status').textContent).toContain('2 events');
  });

  it('closes via Escape', () => {
    render(<CalendarExportControl events={[info('2026-08-29')]} />);
    fireEvent.click(screen.getByTestId('calendar-export'));
    expect(screen.getByTestId('calendar-export-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('calendar-export-menu')).toBeNull();
  });

  it('is disabled when no events are provided', () => {
    render(<CalendarExportControl events={[]} />);
    expect((screen.getByTestId('calendar-export') as HTMLButtonElement).disabled).toBe(true);
  });
});
