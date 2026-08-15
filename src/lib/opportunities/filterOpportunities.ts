import type { ShootingOpportunity, ShootingOpportunityFilters } from './types';
import { filterByMoonPhaseAndTime } from '../alignment/filterResults';
import { collectFullMoonInstants, isWithinFullMoonWindow } from '../astronomy/lunarPhase';

export function filterShootingOpportunities(
  opportunities: ShootingOpportunity[],
  filters: ShootingOpportunityFilters
): ShootingOpportunity[] {
  let filtered = filterByMoonPhaseAndTime(opportunities, {
    moonPhases: filters.moonPhases,
    timeFilter: filters.timeFilter,
    customStartTime: filters.customStartTime,
    customEndTime: filters.customEndTime
  });

  const moonOpportunities = filtered.filter((opportunity) => opportunity.moonPhase !== undefined);
  if (filters.fullMoonOnly && moonOpportunities.length > 0) {
    const instants = moonOpportunities.map((opportunity) => new Date(opportunity.utcInstant));
    const minInstant = new Date(Math.min(...instants.map((instant) => instant.getTime())));
    const maxInstant = new Date(Math.max(...instants.map((instant) => instant.getTime())));
    const fullMoons = collectFullMoonInstants(minInstant, maxInstant);
    filtered = filtered.filter((opportunity) => {
      if (opportunity.moonPhase === undefined) {
        return true;
      }
      return isWithinFullMoonWindow(new Date(opportunity.utcInstant), fullMoons);
    });
  }

  return filtered;
}
