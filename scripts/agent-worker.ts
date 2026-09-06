import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { runReflectionWorker } from "../src/lib/server/spacetime-worker";

async function main() {
  // Deployment-injected variables win. Local overrides precede the shared example defaults.
  for (const file of [".env.local", ".env"]) {
    try { process.loadEnvFile(file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const uri = process.env.SPACETIMEDB_URI || process.env.NEXT_PUBLIC_SPACETIMEDB_URI;
  const database = process.env.SPACETIMEDB_DATABASE || process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE;
  if (!uri || !database) throw new Error("Set SPACETIMEDB_URI and SPACETIMEDB_DATABASE before starting the worker.");
  if (!process.env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY before starting the worker.");

  const storage = resolve(process.cwd(), ".worldline");
  const scope = createHash("sha256").update(`${uri}:${database}`).digest("hex").slice(0, 20);
  const tokenPath = resolve(storage, `worker-token-${scope}`);
  let token = process.env.SPACETIMEDB_WORKER_TOKEN?.trim() || undefined;
  if (!token) {
    try { token = (await readFile(tokenPath, "utf8")).trim() || undefined; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  let retries = 0;
  while (!controller.signal.aborted) {
    try {
      await runReflectionWorker({
        uri, database, token, signal: controller.signal,
        log: message => console.info(`[agents] ${message}`),
        onIdentity: async (identity, issuedToken) => {
          token = issuedToken;
          if (!process.env.SPACETIMEDB_WORKER_TOKEN) {
            await mkdir(storage, { recursive: true, mode: 0o700 });
            await writeFile(tokenPath, issuedToken, { mode: 0o600 });
            await chmod(tokenPath, 0o600);
          }
          retries = 0;
          console.info(`[agents] Worker identity: ${identity}`);
          console.info("[agents] The room owner must authorize this public identity before jobs become visible.");
        },
      });
    } catch {
      if (controller.signal.aborted) break;
      const waitMs = Math.min(30_000, 1_000 * 2 ** Math.min(retries++, 5));
      console.warn(`[agents] Connection unavailable. Reconnecting in ${waitMs / 1_000}s.`);
      await delay(waitMs, undefined, { signal: controller.signal }).catch(() => undefined);
    }
  }
  process.removeListener("SIGINT", shutdown);
  process.removeListener("SIGTERM", shutdown);
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : "Worker could not start.");
  process.exitCode = 1;
});
