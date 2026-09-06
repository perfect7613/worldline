/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/components/hud/HudMeter.tsx
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 */
import type { CSSProperties } from "react";

import { cn } from "@/components/lib/cn";

import { METER_SEGMENTS, filledSegments } from "./meter";

export interface HudMeterProps {
  label: string;
  readout: string;
  value: number;
  tone?: string;
  className?: string;
}

export function HudMeter({
  label,
  readout,
  value,
  tone,
  className,
}: HudMeterProps) {
  const filled = filledSegments(value);

  return (
    <div className={cn("stack-tight", className)}>
      <div className="hud-label row-between">
        <span>{label}</span>
        <span>{readout}</span>
      </div>
      <div
        className="hud-meter"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={readout}
        style={
          tone ? ({ "--hud-meter-fill": tone } as CSSProperties) : undefined
        }
      >
        {Array.from({ length: METER_SEGMENTS }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="hud-meter__cell"
            data-on={index < filled}
          />
        ))}
      </div>
    </div>
  );
}

export default HudMeter;
