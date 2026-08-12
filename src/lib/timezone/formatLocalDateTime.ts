export interface LocalDateTimeParts {
  date: string;
  time: string;
  timeZoneLabel: string;
}

export function formatLocalDateTimeFromUtc(date: Date, timeZone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'shortOffset'
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const dateString = `${values.year}-${values.month}-${values.day}`;
  const timeString = `${values.hour}:${values.minute}:${values.second}`;
  const timeZoneLabel = values.timeZoneName ? `${timeZone} (${values.timeZoneName})` : timeZone;

  return {
    date: dateString,
    time: timeString,
    timeZoneLabel
  };
}
