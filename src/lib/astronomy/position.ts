import * as Astronomy from 'astronomy-engine';
import { GeographicPoint, HorizontalPosition } from '../../types/astronomy';

export function getBodyHorizontalPosition(
  body: 'Sun' | 'Moon',
  datetime: Date,
  observer: GeographicPoint
): HorizontalPosition {
  const astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevation
  );

  const equatorial = Astronomy.Equator(
    body === 'Sun' ? Astronomy.Body.Sun : Astronomy.Body.Moon,
    datetime,
    astroObserver,
    true,
    true
  );

  const horizon = Astronomy.Horizon(
    datetime,
    astroObserver,
    equatorial.ra,
    equatorial.dec,
    'normal'
  );

  return {
    azimuth: normalizeAzimuth(horizon.azimuth),
    altitude: horizon.altitude
  };
}

function normalizeAzimuth(azimuth: number): number {
  const normalized = ((azimuth % 360) + 360) % 360;
  return normalized;
}
