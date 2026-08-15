'use client';

import type { LocationSearchResult } from '../lib/geocoding/types';
import LocationSearch from './LocationSearch';

interface LandmarkSearchProps {
  onSelect: (_result: LocationSearchResult) => void;
  ariaLabel?: string;
}

export default function LandmarkSearch({ onSelect, ariaLabel = 'Landmark' }: LandmarkSearchProps) {
  return (
    <LocationSearch
      idPrefix="landmark"
      ariaLabel={ariaLabel}
      placeholder="Search for a landmark..."
      onSelect={onSelect}
    />
  );
}
