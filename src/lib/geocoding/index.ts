import { nominatimProvider } from './nominatim';

export const activeGeocoder = nominatimProvider;

export { nominatimProvider };
export { GeocodingError } from './types';
export type {
  GeocodingFailureKind,
  GeocodingProvider,
  GeocodingResult,
  SelectedLandmark,
  TargetLocation,
  TargetSource
} from './types';
