import type { AlignmentCandidate } from './types';
import type { TimeFilterOption } from './timeFilter';
import { isTimeWithinWindow, resolveTimeWindow } from './timeFilter';

export interface AlignmentResultFilters {
  moonPhases: string[] | null;
  timeFilter: TimeFilterOption;
  customStartTime?: string;
  customEndTime?: string;
}

export function filterAlignmentResults(
  candidates: AlignmentCandidate[],
  filters: AlignmentResultFilters
): AlignmentCandidate[] {
  return candidates.filter((candidate) => {
    if (filters.moonPhases !== null && candidate.moonPhase !== undefined) {
      if (!filters.moonPhases.includes(candidate.moonPhase.name)) {
        return false;
      }
    }

    if (candidate.moonPhase !== undefined) {
      const timeWindow = resolveTimeWindow({
        option: filters.timeFilter,
        customStartTime: filters.customStartTime,
        customEndTime: filters.customEndTime
      });
      if (timeWindow && !isTimeWithinWindow(candidate.localTime, timeWindow)) {
        return false;
      }
    }

    return true;
  });
}
