import { convertLocalTimeToUtc } from './convertLocalTimeToUtc';

export function formatTimezoneLabel(date: string, time: string, timeZone: string): string {
  const utcDate = convertLocalTimeToUtc(date, time, timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(utcDate);
  const offsetPart = parts.find((part) => part.type === 'timeZoneName');
  const offset = offsetPart?.value ?? '';
  return `${timeZone} (${offset})`;
}
