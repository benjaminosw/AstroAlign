import { findRiseSetAlignments } from './findRiseSetAlignments';
import { findAltitudeAlignments } from './findAltitudeAlignments';
import type { FindAlignmentsInput } from './types';

export function findAlignments(input: FindAlignmentsInput) {
  const bothAtSeaLevel =
    input.observer.elevation === 0 &&
    input.target.elevation === 0;

  if (bothAtSeaLevel) {
    return findRiseSetAlignments(input);
  }

  return findAltitudeAlignments(input);
}
