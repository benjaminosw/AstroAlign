import { describe, expect, it } from 'vitest';
import { isTimeWithinWindow, resolveTimeWindow } from '../timeFilter';

describe('resolveTimeWindow', () => {
  it('returns null for the any option', () => {
    expect(resolveTimeWindow({ option: 'any' })).toBeNull();
  });

  it('returns preset windows for night, evening, and overnight', () => {
    expect(resolveTimeWindow({ option: 'night' })).toEqual({ start: '18:00', end: '07:00' });
    expect(resolveTimeWindow({ option: 'evening' })).toEqual({ start: '18:00', end: '23:59' });
    expect(resolveTimeWindow({ option: 'overnight' })).toEqual({ start: '00:00', end: '07:00' });
  });

  it('returns the custom window when both custom times are provided', () => {
    expect(
      resolveTimeWindow({ option: 'custom', customStartTime: '20:30', customEndTime: '04:00' })
    ).toEqual({ start: '20:30', end: '04:00' });
  });

  it('returns null for a custom window missing either time', () => {
    expect(resolveTimeWindow({ option: 'custom', customStartTime: '', customEndTime: '07:00' })).toBeNull();
    expect(resolveTimeWindow({ option: 'custom', customStartTime: '18:00', customEndTime: ' ' })).toBeNull();
  });
});

describe('isTimeWithinWindow', () => {
  it('includes times inside a window that does not cross midnight', () => {
    const window = { start: '18:00', end: '23:59' };
    expect(isTimeWithinWindow('18:00:00', window)).toBe(true);
    expect(isTimeWithinWindow('20:15:30', window)).toBe(true);
    expect(isTimeWithinWindow('23:59:59', window)).toBe(true);
    expect(isTimeWithinWindow('12:00:00', window)).toBe(false);
  });

  it('includes times inside a window that crosses midnight', () => {
    const window = { start: '18:00', end: '07:00' };
    expect(isTimeWithinWindow('19:42:18', window)).toBe(true);
    expect(isTimeWithinWindow('23:59:59', window)).toBe(true);
    expect(isTimeWithinWindow('00:30:00', window)).toBe(true);
    expect(isTimeWithinWindow('06:59:59', window)).toBe(true);
    expect(isTimeWithinWindow('07:00:00', window)).toBe(true);
    expect(isTimeWithinWindow('14:32:00', window)).toBe(false);
  });

  it('treats boundaries inclusively at HH:mm precision', () => {
    expect(isTimeWithinWindow('18:00:00', { start: '18:00', end: '23:59' })).toBe(true);
    expect(isTimeWithinWindow('18:00:00', { start: '18:00', end: '07:00' })).toBe(true);
    expect(isTimeWithinWindow('07:00:00', { start: '18:00', end: '07:00' })).toBe(true);
    expect(isTimeWithinWindow('07:01:00', { start: '18:00', end: '07:00' })).toBe(false);
  });
});
