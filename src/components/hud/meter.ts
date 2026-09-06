/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/components/hud/meter.ts
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 */

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
