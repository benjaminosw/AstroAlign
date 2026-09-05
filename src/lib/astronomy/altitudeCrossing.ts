import type { GeographicPoint } from '../../types/astronomy';
import { getBodyHorizontalPosition } from './position';

const COARSE_STEP_MS = 10 * 60 * 1000;
const PRECISION_MS = 1000;

export interface AltitudeCrossing {
  time: Date;
  azimuth: number;
  altitude: number;
  direction: 'rise' | 'set';
}

type BodyName = 'Sun' | 'Moon';

function altitudeAt(body: BodyName, observer: GeographicPoint, time: Date): number {
  return getBodyHorizontalPosition(body, time, observer).altitude;
}

function bisectCrossing(
  body: BodyName,
  observer: GeographicPoint,
  targetAltitudeDeg: number,
  left: number,
  right: number
): { time: number; altitude: number } {
  let lo = left;
  let hi = right;
  let fLo = altitudeAt(body, observer, new Date(lo)) - targetAltitudeDeg;

  while (hi - lo > PRECISION_MS) {
    const mid = (lo + hi) / 2;
    const fMid = altitudeAt(body, observer, new Date(mid)) - targetAltitudeDeg;

    if (Math.sign(fMid) === Math.sign(fLo) || fMid === 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }

  const time = (lo + hi) / 2;
  return { time, altitude: altitudeAt(body, observer, new Date(time)) };
}

export function findAltitudeCrossings(
  body: BodyName,
  observer: GeographicPoint,
  targetAltitudeDeg: number,
  start: Date,
  end: Date
): AltitudeCrossing[] {
  const crossings: AltitudeCrossing[] = [];

  const startMs = start.getTime();
  const endMs = end.getTime();
  const stepMs = Math.max(1, COARSE_STEP_MS);

  let previousTime = startMs;
  let previousAlt = altitudeAt(body, observer, new Date(previousTime)) - targetAltitudeDeg;

  for (let t = startMs + stepMs; t <= endMs + stepMs; t += stepMs) {
    const sampleTime = Math.min(t, endMs);
    const sampleAlt = altitudeAt(body, observer, new Date(sampleTime)) - targetAltitudeDeg;

    if ((previousAlt <= 0 && sampleAlt >= 0) || (previousAlt >= 0 && sampleAlt <= 0)) {
      if (previousAlt !== 0 || sampleAlt !== 0) {
        const refined = bisectCrossing(body, observer, targetAltitudeDeg, previousTime, sampleTime);
        const position = getBodyHorizontalPosition(body, new Date(refined.time), observer);
        crossings.push({
          time: new Date(refined.time),
          azimuth: position.azimuth,
          altitude: position.altitude,
          direction: sampleAlt >= previousAlt ? 'rise' : 'set'
        });
      }
    }

    previousTime = sampleTime;
    previousAlt = sampleAlt;

    if (sampleTime >= endMs) {
      break;
    }
  }

  return crossings;
}
