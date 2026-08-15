export type TimeFilterOption = 'any' | 'night' | 'evening' | 'overnight' | 'custom';

export interface TimeWindow {
  start: string;
  end: string;
}

export interface TimeFilterInput {
  option: TimeFilterOption;
  customStartTime?: string;
  customEndTime?: string;
}

export const TIME_FILTER_PRESETS: Record<Exclude<TimeFilterOption, 'custom'>, TimeWindow> = {
  any: { start: '00:00', end: '23:59' },
  night: { start: '18:00', end: '07:00' },
  evening: { start: '18:00', end: '23:59' },
  overnight: { start: '00:00', end: '07:00' }
};

export function resolveTimeWindow(filter: TimeFilterInput): TimeWindow | null {
  if (filter.option === 'any') {
    return null;
  }

  if (filter.option === 'custom') {
    const start = filter.customStartTime?.trim() ?? '';
    const end = filter.customEndTime?.trim() ?? '';
    if (!start || !end) {
      return null;
    }
    return { start, end };
  }

  return TIME_FILTER_PRESETS[filter.option];
}

export function isTimeWithinWindow(time: string, window: TimeWindow): boolean {
  const value = time.slice(0, 5);
  if (window.start <= window.end) {
    return value >= window.start && value <= window.end;
  }
  return value >= window.start || value <= window.end;
}
