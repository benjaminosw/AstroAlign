export interface GeocodingResult {
  id: string;
  name: string;
  locality?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface GeocodingProvider {
  search(_query: string, _options?: { signal?: AbortSignal }): Promise<GeocodingResult[]>;
}

export interface SelectedLandmark extends GeocodingResult {}

export type TargetSource = 'manual' | 'landmark' | 'map';

export interface TargetLocation {
  latitude: number;
  longitude: number;
  name?: string;
  source?: TargetSource;
}

export type GeocodingFailureKind = 'network' | 'rate-limit' | 'server';

export class GeocodingError extends Error {
  public readonly kind: GeocodingFailureKind;

  constructor(message: string, kind: GeocodingFailureKind) {
    super(message);
    this.name = 'GeocodingError';
    this.kind = kind;
  }
}
