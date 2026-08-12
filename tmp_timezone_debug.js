const timeZone = 'Asia/Singapore';
const date = '2026-08-12';
const time = '19:00';
function parseLocalDateTime(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute, second: 0 };
}
function formatDateTimeParts(date, timeZone) {
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
  const result = {};
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
function toUtcMillis(fields) {
  return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
}
const localFields = parseLocalDateTime(date, time);
const targetLocalMillis = toUtcMillis(localFields);
console.log('targetLocalMillis', targetLocalMillis, new Date(targetLocalMillis).toISOString());
let candidateUtcMillis = targetLocalMillis;
for (let iteration = 0; iteration < 10; iteration++) {
  const actualLocalFields = formatDateTimeParts(new Date(candidateUtcMillis), timeZone);
  const actualLocalMillis = toUtcMillis(actualLocalFields);
  const delta = targetLocalMillis - actualLocalMillis;
  console.log('iteration', iteration, 'candidateUtc', new Date(candidateUtcMillis).toISOString(), 'actualLocal', actualLocalFields, 'actualLocalMillis', actualLocalMillis, new Date(actualLocalMillis).toISOString(), 'delta', delta);
  if (delta === 0) break;
  candidateUtcMillis += delta;
}
console.log('finalUtc', new Date(candidateUtcMillis).toISOString());
