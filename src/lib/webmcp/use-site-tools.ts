"use client";

import { useEffect, useRef } from "react";

import { registerSiteTools, type SiteTool, type ModelContext } from "./register";
export { emptyInput } from "./register";

/** Top-level progressive enhancement. The UI remains fully usable without WebMCP. */
export function useSiteTools(tools: SiteTool[], enabled = true) {
  const latest = useRef(tools);
  latest.current = tools;
  const names = tools.map(tool => tool.name).join("|");
  useEffect(() => {
    if (!enabled || window.top !== window) return;
    const context = (document as Document & { modelContext?: ModelContext }).modelContext
      ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") return;
    return registerSiteTools(context, () => latest.current);
  }, [names, enabled]);
}
