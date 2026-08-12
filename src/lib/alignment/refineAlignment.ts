import type { AlignmentOutput } from '../../types/astronomy';
import type { FindAlignmentsInput } from './types';
import { calculateAlignmentAtInstant } from './instantAlignment';

function evaluateInstant(date: Date, input: FindAlignmentsInput): AlignmentOutput {
  if (input.alignmentEvaluator) {
    return input.alignmentEvaluator(date);
  }

  return calculateAlignmentAtInstant({
    observer: input.observer,
    target: input.target,
    object: input.object,
    datetime: date,
    toleranceDegrees: input.toleranceDegrees
  });
}

export async function refineAlignment(
  centerUtc: Date,
  input: FindAlignmentsInput,
  rangeStartUtc: Date,
  rangeEndUtc: Date
): Promise<{ date: Date; alignment: AlignmentOutput }> {
  const halfWindowMs = 20 * 60 * 1000;
  const precisionMs = 1000;

  const start = new Date(Math.max(rangeStartUtc.getTime(), centerUtc.getTime() - halfWindowMs));
  const end = new Date(Math.min(rangeEndUtc.getTime(), centerUtc.getTime() + halfWindowMs));

  let left = start.getTime();
  let right = end.getTime();
  let best: { date: Date; alignment: AlignmentOutput } = { date: centerUtc, alignment: evaluateInstant(centerUtc, input) };

  while (right - left > precisionMs) {
    if (input.signal?.aborted) {
      throw new Error('Search canceled');
    }

    const mid1 = new Date(left + (right - left) / 3);
    const mid2 = new Date(left + (2 * (right - left)) / 3);

    const mid1Result = evaluateInstant(mid1, input);
    const mid2Result = evaluateInstant(mid2, input);

    if (mid1Result.alignment.angularSeparation < best.alignment.angularSeparation) {
      best = { date: mid1, alignment: mid1Result };
    }

    if (mid2Result.alignment.angularSeparation < best.alignment.angularSeparation) {
      best = { date: mid2, alignment: mid2Result };
    }

    if (mid1Result.alignment.angularSeparation < mid2Result.alignment.angularSeparation) {
      right = mid2.getTime();
    } else {
      left = mid1.getTime();
    }

    if (right - left <= precisionMs) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const leftResult = evaluateInstant(new Date(left), input);
  const rightResult = evaluateInstant(new Date(right), input);

  if (leftResult.alignment.angularSeparation < best.alignment.angularSeparation) {
    best = { date: new Date(left), alignment: leftResult };
  }

  if (rightResult.alignment.angularSeparation < best.alignment.angularSeparation) {
    best = { date: new Date(right), alignment: rightResult };
  }

  return best;
}
