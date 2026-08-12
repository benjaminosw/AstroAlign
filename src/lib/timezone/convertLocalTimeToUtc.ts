function parseLocalDateTime(date: string, time: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const [year, month, day] = date.split('-').map(Number);
  const parts = time.split(':').map(Number);

  if (parts.length < 2 || parts.length > 3) {
    throw new Error('Invalid time format');
  }

  const [hour, minute, second = 0] = parts;

  if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) {
    throw new Error('Invalid date or time format');
  }

  return { year, month, day, hour, minute, second };
}

function formatDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const result: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      result[part.type] = part.value;
    }
  }

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),
    hour: Number(result.hour),
    minute: Number(result.minute),
    second: Number(result.second)
  };
}

function toUtcMillis(fields: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
}

export function convertLocalTimeToUtc(date: string, time: string, timeZone: string): Date {
  const localFields = parseLocalDateTime(date, time);
  const targetLocalMillis = toUtcMillis(localFields);
  let candidateUtcMillis = targetLocalMillis;

  for (let iteration = 0; iteration < 10; iteration++) {
    const actualLocalFields = formatDateTimeParts(new Date(candidateUtcMillis), timeZone);
    const actualLocalMillis = toUtcMillis(actualLocalFields);
    const delta = targetLocalMillis - actualLocalMillis;

    if (delta === 0) {
      return new Date(candidateUtcMillis);
    }

    candidateUtcMillis += delta;
  }

  return new Date(candidateUtcMillis);
}
