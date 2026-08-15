import { GeocodingError } from './types';
import type { GeocodingService, GeocodingProvider, GeocodingResult } from './types';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const RESULT_LIMIT = 8;

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

interface NominatimPlace {
  place_id?: string | number;
  osm_id?: string | number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

function toLocality(address: NominatimAddress | undefined): string | undefined {
  if (!address) {
    return undefined;
  }
  return address.city ?? address.town ?? address.village ?? address.municipality ?? address.state;
}

export const nominatimProvider: GeocodingService & GeocodingProvider = {
  async search(query, options) {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(RESULT_LIMIT),
      'accept-language': 'en'
    });

    let response: Response;
    try {
      const init = {
        signal: options?.signal,
        headers: { Accept: 'application/json' },
        ...(typeof window !== 'undefined' && window.location
          ? { referrer: `${window.location.origin}/`, referrerPolicy: 'strict-origin-when-cross-origin' as const }
          : {})
      };
      response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, init);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      throw new GeocodingError('Unable to search for landmarks. Check your connection and try again.', 'network');
    }

    if (response.status === 429) {
      throw new GeocodingError('Too many landmark searches. Please wait a moment and try again.', 'rate-limit');
    }

    if (!response.ok) {
      throw new GeocodingError('Unable to search for landmarks. Check your connection and try again.', 'server');
    }

    let places: NominatimPlace[];
    try {
      places = (await response.json()) as NominatimPlace[];
    } catch {
      throw new GeocodingError('Unable to search for landmarks. Check your connection and try again.', 'server');
    }

    return places
      .map((place): (GeocodingResult & { formattedAddress: string }) | null => {
        const latitude = Number(place.lat);
        const longitude = Number(place.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        const address = place.address;
        const locality = toLocality(address);
        return {
          id: String(place.osm_id ?? place.place_id ?? `${latitude},${longitude}`),
          name: place.name ?? place.display_name.split(',')[0].trim(),
          locality,
          country: address?.country,
          formattedAddress: place.display_name,
          latitude,
          longitude
        };
      })
      .filter((place): place is GeocodingResult & { formattedAddress: string } => place !== null);
  }
};
