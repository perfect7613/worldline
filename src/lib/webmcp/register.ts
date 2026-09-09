export interface SiteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}
export interface ModelContext {
  registerTool: (tool: SiteTool, options?: { signal: AbortSignal }) => void | Promise<void>;
  unregisterTool?: (name: string) => void;
}
export const emptyInput = { type: "object", properties: {}, additionalProperties: false };


/** Register only this component's tools; never clear other page integrations. */
export function registerSiteTools(context: ModelContext, currentTools: () => SiteTool[]) {
  const lifetime = new AbortController();
  const registered: string[] = [];
  for (const tool of currentTools()) {
    try {
      const registration = context.registerTool({ ...tool, execute: async input => {
        if (lifetime.signal.aborted) return { ok: false, error: "This page is no longer active." };
        try {
          const current = currentTools().find(candidate => candidate.name === tool.name);
          if (!current) throw new Error("This action is no longer available.");
          return { ok: true, result: await current.execute(input ?? {}) };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "The action could not be completed." };
        }
      } }, { signal: lifetime.signal });
      registered.push(tool.name);
      void Promise.resolve(registration).catch(error => {
        if (!lifetime.signal.aborted) console.warn(`Site tool ${tool.name} unavailable`, error);
      });
    } catch (error) {
      console.warn(`Site tool ${tool.name} unavailable`, error);
    }
  }
  return () => {
    lifetime.abort();
    for (const name of registered) context.unregisterTool?.(name);
  };
}
