export const ALIGNMENT_QUALITY = {
  Excellent: 'Excellent',
  VeryGood: 'Very good',
  Good: 'Good',
  Fair: 'Fair',
  Poor: 'Poor'
} as const;

export type AlignmentQuality = (typeof ALIGNMENT_QUALITY)[keyof typeof ALIGNMENT_QUALITY];

const QUALITY_THRESHOLDS = {
  excellent: 0.1,
  veryGood: 0.25,
  good: 0.5,
  fair: 1.0
};

export function getAlignmentQuality(separationDegrees: number): AlignmentQuality {
  if (separationDegrees <= QUALITY_THRESHOLDS.excellent) {
    return ALIGNMENT_QUALITY.Excellent;
  }

  if (separationDegrees <= QUALITY_THRESHOLDS.veryGood) {
    return ALIGNMENT_QUALITY.VeryGood;
  }

  if (separationDegrees <= QUALITY_THRESHOLDS.good) {
    return ALIGNMENT_QUALITY.Good;
  }

  if (separationDegrees <= QUALITY_THRESHOLDS.fair) {
    return ALIGNMENT_QUALITY.Fair;
  }

  return ALIGNMENT_QUALITY.Poor;
}

export function getAlignmentStars(separationDegrees: number): string {
  switch (getAlignmentQuality(separationDegrees)) {
    case ALIGNMENT_QUALITY.Excellent:
      return '★★★★★';
    case ALIGNMENT_QUALITY.VeryGood:
      return '★★★★☆';
    case ALIGNMENT_QUALITY.Good:
      return '★★★☆☆';
    case ALIGNMENT_QUALITY.Fair:
      return '★★☆☆☆';
    default:
      return '★☆☆☆☆';
  }
}
