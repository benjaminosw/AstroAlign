import tzlookup from 'tz-lookup';

export interface TimezoneLookupResult {
  timeZone: string;
}

export function getTimezoneFromCoordinates(latitude: number, longitude: number): TimezoneLookupResult {
  const timeZone = tzlookup(latitude, longitude);
  return { timeZone };
}
