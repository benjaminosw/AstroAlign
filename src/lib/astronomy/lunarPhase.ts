import * as Astronomy from 'astronomy-engine';

const FULL_MOON_PHASE = 180;

export function collectFullMoonInstants(startDate: Date, endDate: Date): Date[] {
  const fullMoons: Date[] = [];
  const searchStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  let windowDays = (endDate.getTime() - searchStart.getTime()) / (24 * 60 * 60 * 1000) + 2;
  let nextSearchStart = new Date(searchStart);

  while (true) {
    const fullMoon = Astronomy.SearchMoonPhase(FULL_MOON_PHASE, nextSearchStart, windowDays);
    if (!fullMoon) {
      break;
    }

    const fullMoonDate = fullMoon.date;
    if (fullMoonDate.getTime() > endDate.getTime() + 24 * 60 * 60 * 1000) {
      break;
    }

    fullMoons.push(fullMoonDate);
    nextSearchStart = new Date(fullMoonDate.getTime() + 60_000);
    windowDays = (endDate.getTime() - nextSearchStart.getTime()) / (24 * 60 * 60 * 1000) + 2;
    if (windowDays <= 0) {
      break;
    }
  }

  return fullMoons;
}

export function isWithinFullMoonWindow(eventDate: Date, fullMoonInstants: Date[]): boolean {
  return fullMoonInstants.some((fullMoonInstant) => {
    const differenceMs = Math.abs(eventDate.getTime() - fullMoonInstant.getTime());
    return differenceMs <= 24 * 60 * 60 * 1000;
  });
}
