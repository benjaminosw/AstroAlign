export enum AstroObject {
  Sun = 'Sun',
  Moon = 'Moon'
}

export interface GeographicPoint {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface Target extends GeographicPoint {}

export interface AlignmentInput {
  observer: GeographicPoint;
  target: Target;
  object: AstroObject;
  date: string;
  time: string;
  timeZone?: string;
  toleranceDegrees: number;
}

export interface HorizontalPosition {
  azimuth: number;
  altitude: number;
}

export interface TargetDirection {
  distanceKm: number;
  bearing: number;
  altitude: number;
}

export interface AlignmentOutput {
  object: HorizontalPosition;
  target: TargetDirection;
  alignment: {
    angularSeparation: number;
    azimuthDelta: number;
    altitudeDelta: number;
    withinTolerance: boolean;
  };
}
