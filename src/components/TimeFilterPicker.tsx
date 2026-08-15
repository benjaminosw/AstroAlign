'use client';

import type { TimeFilterOption } from '../lib/alignment/timeFilter';

export const TIME_FILTER_OPTIONS: Array<{ value: TimeFilterOption; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'night', label: 'Night (18:00 – 07:00)' },
  { value: 'evening', label: 'Evening (18:00 – 23:59)' },
  { value: 'overnight', label: 'Overnight (00:00 – 07:00)' },
  { value: 'custom', label: 'Custom…' }
];

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20';

interface TimeFilterPickerProps {
  option: TimeFilterOption;
  customStartTime: string;
  customEndTime: string;
  onOptionChange: (_option: TimeFilterOption) => void;
  onCustomStartChange: (_time: string) => void;
  onCustomEndChange: (_time: string) => void;
}

export default function TimeFilterPicker({
  option,
  customStartTime,
  customEndTime,
  onOptionChange,
  onCustomStartChange,
  onCustomEndChange
}: TimeFilterPickerProps) {
  return (
    <div>
      <select
        id="find-time-filter"
        value={option}
        onChange={(event) => onOptionChange(event.target.value as TimeFilterOption)}
        className={inputClass}
      >
        {TIME_FILTER_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {option === 'custom' && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="find-time-filter-start" className="block text-sm text-slate-300">
              From
            </label>
            <input
              id="find-time-filter-start"
              type="time"
              value={customStartTime}
              onChange={(event) => onCustomStartChange(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <div>
            <label htmlFor="find-time-filter-end" className="block text-sm text-slate-300">
              To
            </label>
            <input
              id="find-time-filter-end"
              type="time"
              value={customEndTime}
              onChange={(event) => onCustomEndChange(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
