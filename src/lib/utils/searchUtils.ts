export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isValidIsoDate(date: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
}

export function isValidTolerance(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
