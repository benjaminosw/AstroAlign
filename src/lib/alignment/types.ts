import type { AlignmentInput, AlignmentOutput, GeographicPoint } from '../../types/astronomy';

export type AlignmentEvaluator = (_datetime: Date) => AlignmentOutput | Promise<AlignmentOutput>;

export interface FindAlignmentsInput {
  observer: GeographicPoint;
  target: GeographicPoint;
  object: AlignmentInput['object'];
  startDate: string;
  endDate: string;
  toleranceDegrees: number;
  timeZone: string;
  fullMoonOnly?: boolean;
  signal?: AbortSignal;
  onProgress?: (_completed: number, _total: number) => void;
  alignmentEvaluator?: AlignmentEvaluator;
}

export interface AlignmentCandidate extends AlignmentOutput {
  eventType: 'rise' | 'set';
  eventLabel: string;
  localDate: string;
  localTime: string;
  timeZone: string;
  timeZoneLabel: string;
  score: number;
  moonIlluminationPercent?: number;
  moonDistanceKm?: number;
  sunDistanceKm?: number;
}
