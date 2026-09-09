export const METER_SEGMENTS = 20;

export function filledSegments(
  value: number,
  segments: number = METER_SEGMENTS,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(segments, Math.round((value / 100) * segments));
}
