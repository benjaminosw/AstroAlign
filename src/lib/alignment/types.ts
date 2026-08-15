import type { AlignmentInput, AlignmentOutput, GeographicPoint } from '../../types/astronomy';
import type { MoonPhaseInfo } from '../astronomy/lunarPhase';

export type AlignmentEvaluator = (_datetime: Date) => AlignmentOutput | Promise<AlignmentOutput>;

export interface FindAlignmentsInput {
  observer: GeographicPoint;
  target: GeographicPoint;
  object: AlignmentInput['object'];
  startDate: string;
  endDate: string;
  toleranceDegrees: number;
  timeZone: string;
  signal?: AbortSignal;
  onProgress?: (_completed: number, _total: number) => void;
  alignmentEvaluator?: AlignmentEvaluator;
}

export interface AlignmentCandidate extends AlignmentOutput {
  utcInstant: string;
  eventType: 'rise' | 'set';
  eventLabel: string;
  localDate: string;
  localTime: string;
  timeZone: string;
  timeZoneLabel: string;
  score: number;
  moonPhase?: MoonPhaseInfo;
  moonIlluminationPercent?: number;
  moonDistanceKm?: number;
  sunDistanceKm?: number;
}
