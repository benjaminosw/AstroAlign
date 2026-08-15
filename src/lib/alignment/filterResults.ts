import type { AlignmentCandidate } from './types';
import type { TimeFilterOption } from './timeFilter';
import { isTimeWithinWindow, resolveTimeWindow } from './timeFilter';
import type { MoonPhaseInfo } from '../astronomy/lunarPhase';

export interface AlignmentResultFilters {
  moonPhases: string[] | null;
  timeFilter: TimeFilterOption;
  customStartTime?: string;
  customEndTime?: string;
}

export interface MoonAndTimeFilterable {
  moonPhase?: MoonPhaseInfo;
  localTime: string;
}

export function filterByMoonPhaseAndTime<T extends MoonAndTimeFilterable>(
  items: T[],
  filters: AlignmentResultFilters
): T[] {
  return items.filter((item) => {
    if (filters.moonPhases !== null && item.moonPhase !== undefined) {
      if (!filters.moonPhases.includes(item.moonPhase.name)) {
        return false;
      }
    }

    if (item.moonPhase !== undefined) {
      const timeWindow = resolveTimeWindow({
        option: filters.timeFilter,
        customStartTime: filters.customStartTime,
        customEndTime: filters.customEndTime
      });
      if (timeWindow && !isTimeWithinWindow(item.localTime, timeWindow)) {
        return false;
      }
    }

    return true;
  });
}

export function filterAlignmentResults(
  candidates: AlignmentCandidate[],
  filters: AlignmentResultFilters
): AlignmentCandidate[] {
  return filterByMoonPhaseAndTime(candidates, filters);
}
