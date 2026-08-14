export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isValidIsoDate(date: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
}

export function isValidTolerance(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) =>
    isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}
