/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/components/hud/HudWindow.tsx
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 * Imports adapted to local cn / click helpers.
 */
import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useUiClick } from "@/components/lib/use-ui-click";
import { cn } from "@/components/lib/cn";

export interface HudWindowProps {
  id: string;
  title: string;
  hint?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: string;
  expanded: boolean;
  onToggle: () => void;
  fill?: boolean;
  className?: string;
  bodyClassName?: string;
  persistent?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function HudWindow({
  id,
  title,
  hint,
  icon,
  meta,
  actions,
  accent,
  expanded,
  onToggle,
  fill = false,
  className,
  bodyClassName,
  persistent,
  footer,
  children,
}: HudWindowProps) {
  const playClick = useUiClick();
  const bodyId = `${id}-body`;

  return (
    <section
      data-expanded={expanded}
      className={cn("hud-window", fill && "hud-window--fill", className)}
      style={
        accent ? ({ "--hud-accent": accent } as CSSProperties) : undefined
      }
    >
      <span aria-hidden="true" className="hud-window__frame" />

      <header className="hud-window__bar">
        {icon ?? <span aria-hidden="true" className="hud-window__tick" />}
        <h2 className="hud-window__title retro">{title}</h2>
        {hint ? <span className="hud-window__hint retro">{hint}</span> : null}
        <span aria-hidden="true" className="hud-window__leader" />
        {meta}
        {actions}
        <button
          type="button"
          className="hud-window__toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `Make ${title} compact` : `Expand ${title}`}
          title={expanded ? "Make compact" : "Expand"}
          onClick={() => {
            playClick();
            onToggle();
          }}
        >
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </header>

      {children ? (
        <div id={bodyId} className="hud-window__reveal" inert={!expanded}>
          <div className="hud-window__reveal-inner">
            <div className={cn("hud-window__body", bodyClassName)}>
              {children}
            </div>
          </div>
        </div>
      ) : null}

      {persistent ? (
        <div className="hud-window__persistent">{persistent}</div>
      ) : null}

      {footer ? <footer className="hud-window__footer">{footer}</footer> : null}
    </section>
  );
}

export default HudWindow;
