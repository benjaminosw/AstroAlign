import { nominatimProvider } from './nominatim';

export const activeGeocoder: import('./types').GeocodingService & import('./types').GeocodingProvider =
  nominatimProvider;

export { nominatimProvider };
export { GeocodingError } from './types';
export type {
  GeocodingFailureKind,
  GeocodingProvider,
  GeocodingResult,
  GeocodingService,
  LocationSearchResult,
  SelectedLandmark,
  TargetLocation,
  TargetSource
} from './types';
