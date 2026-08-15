import * as Astronomy from 'astronomy-engine';

const FULL_MOON_PHASE = 180;

export function collectFullMoonInstants(startDate: Date, endDate: Date): Date[] {
  const fullMoons: Date[] = [];
  const searchStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  let windowDays = (endDate.getTime() - searchStart.getTime()) / (24 * 60 * 60 * 1000) + 2;
  let nextSearchStart = new Date(searchStart);

  while (windowDays > 0) {
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

export interface MoonPhaseBucket {
  name: string;
  emoji: string;
}

export interface MoonPhaseInfo extends MoonPhaseBucket {
  phaseAngle: number;
  illuminationPercent: number;
}

const MOON_PHASE_BUCKETS: MoonPhaseBucket[] = [
  { name: 'New Moon', emoji: '🌑' },
  { name: 'Waxing Crescent', emoji: '🌒' },
  { name: 'First Quarter', emoji: '🌓' },
  { name: 'Waxing Gibbous', emoji: '🌔' },
  { name: 'Full Moon', emoji: '🌕' },
  { name: 'Waning Gibbous', emoji: '🌖' },
  { name: 'Last Quarter', emoji: '🌗' },
  { name: 'Waning Crescent', emoji: '🌘' }
];

export function moonPhaseBucket(phaseAngle: number): MoonPhaseBucket {
  const normalized = ((phaseAngle % 360) + 360) % 360;
  const bucketSize = 360 / MOON_PHASE_BUCKETS.length;
  const index = Math.floor((normalized + bucketSize / 2) / bucketSize) % MOON_PHASE_BUCKETS.length;
  return MOON_PHASE_BUCKETS[index];
}

export function getMoonPhase(instant: Date): MoonPhaseInfo {
  const phaseAngle = Astronomy.MoonPhase(instant);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, instant);
  const bucket = moonPhaseBucket(phaseAngle);
  return {
    name: bucket.name,
    emoji: bucket.emoji,
    phaseAngle,
    illuminationPercent: illumination.phase_fraction * 100
  };
}
