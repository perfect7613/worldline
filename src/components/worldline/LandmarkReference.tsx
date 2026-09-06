"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { daylightAt } from "@/game/daylight";
import { CITY_THEMES } from "@/game/city-themes";
import type { ScenarioMode } from "@/game/world-data";
import { useFocusTrap } from "./useFocusTrap";
import assets from "../../../third-party/landmark-assets.json";

export function LandmarkReference({ mode }: { mode: ScenarioMode }) {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setClock(`${daylightAt(now).phase} · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(open, ref, close);
  const theme = CITY_THEMES[mode];
  const asset = assets.assets[mode === "founder" ? 0 : 1];
  return <>
    <div className="city-location-row">
    <button className="landmark-chip retro" onClick={() => setOpen(true)} aria-label={`View ${theme.landmark} reference`}>
      {theme.landmark} <span aria-hidden="true">↗</span>
    </button>
    <div className="city-clock retro" title="Lighting follows your device’s local time">{clock && `${clock} · local time`}</div>
    </div>
    {open && <div className="shared-modal-backdrop" onClick={close}>
      <div ref={ref} className="landmark-reference hud-window" role="dialog" aria-modal="true" aria-labelledby="landmark-title" onClick={event => event.stopPropagation()}>
        <button className="hud-button hud-button--sm" onClick={close}>Close</button>
        <h2 id="landmark-title">{theme.landmark}</h2>
        <img src={theme.photo} alt={asset.name} width={asset.width} height={asset.height} />
        <p>Real-world reference for our illustrated city landmark.</p>
        <p>{asset.attribution}</p>
        {mode === "policy" && <p>The current triangular Parliament is in the foreground. Photo use does not imply government endorsement.</p>}
        <a href={asset.source} target="_blank" rel="noreferrer">View source photograph</a>
      </div>
    </div>}
  </>;
}
