import * as Astronomy from 'astronomy-engine';
import type { GeographicPoint } from '../../types/astronomy';
import { getBodyHorizontalPosition } from './position';
import { convertLocalTimeToUtc } from '../timezone/convertLocalTimeToUtc';
import { formatLocalDateTimeFromUtc } from '../timezone/formatLocalDateTime';

export type RiseSetObject = 'Sun' | 'Moon';
export type RiseSetType = 'rise' | 'set';

export interface RiseSetEvent {
  body: RiseSetObject;
  type: RiseSetType;
  instant: Date;
  azimuth: number;
  altitude: number;
}

export function findRiseSetEvent(
  body: RiseSetObject,
  observer: GeographicPoint,
  type: RiseSetType,
  startUtc: Date,
  limitDays: number
): RiseSetEvent | null {
  const astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );

  const direction = type === 'rise' ? 1 : -1;
  const eventTime = Astronomy.SearchRiseSet(
    body === 'Sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon,
    astroObserver,
    direction,
    startUtc,
    limitDays,
    observer.elevation
  );

  if (!eventTime) {
    return null;
  }

  const eventDate = eventTime.date;
  const position = getBodyHorizontalPosition(body, eventDate, observer);

  return {
    body,
    type,
    instant: eventDate,
    azimuth: position.azimuth,
    altitude: position.altitude
  };
}

export interface RiseSetLocalTimes {
  rise: string | null;
  set: string | null;
}

export function findRiseSetLocalTimes(
  body: RiseSetObject,
  observer: GeographicPoint,
  date: string,
  timeZone: string
): RiseSetLocalTimes {
  const dayStartUtc = convertLocalTimeToUtc(date, '00:00:00', timeZone);
  const result: RiseSetLocalTimes = { rise: null, set: null };

  for (const type of ['rise', 'set'] as const) {
    const event = findRiseSetEvent(body, observer, type, dayStartUtc, 2);
    if (!event) {
      continue;
    }
    if (formatLocalDateTimeFromUtc(event.instant, timeZone).date !== date) {
      continue;
    }
    result[type] = formatLocalDateTimeFromUtc(event.instant, timeZone).time.slice(0, 5);
  }

  return result;
}
