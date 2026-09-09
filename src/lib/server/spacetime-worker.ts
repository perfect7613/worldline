import { DbConnection } from "../spacetime/generated";
import type { Job } from "../spacetime/generated/types";
import { retrieveMemories } from "../../server/memory";
import { reflectMemory } from "../agents";

export type ReflectionWorkerOptions = {
  uri: string;
  database: string;
  token?: string;
  signal: AbortSignal;
  onIdentity: (identity: string, token: string) => Promise<void>;
  log?: (message: string) => void;
};

/** A persistent process, separate from Vercel requests. Reducers retain lease authority. */
export function runReflectionWorker(options: ReflectionWorkerOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let connection: DbConnection | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let busy = false;
    let stopped = false;
    let identity = "";
    const retryAt = new Map<string, number>();
    const log = options.log ?? (() => undefined);
    const finish = (error?: Error) => {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      options.signal.removeEventListener("abort", abort);
      connection?.disconnect();
      if (error) reject(error); else resolve();
    };
    const abort = () => finish();
    if (options.signal.aborted) { resolve(); return; }
    options.signal.addEventListener("abort", abort, { once: true });

    async function waitFor<T>(read: () => T | undefined): Promise<T> {
      const deadline = Date.now() + 8_000;
      while (!stopped && Date.now() < deadline) {
        const value = read();
        if (value !== undefined) return value;
        await new Promise(done => setTimeout(done, 50));
      }
      throw new Error("Worker subscription did not provide the claimed job and its evidence.");
    }

    async function processJob(conn: DbConnection, candidate: Job) {
      await conn.reducers.claimJob({ jobId: candidate.id });
      const claimed = await waitFor(() => Array.from(conn.db.workerJobs.iter()).find(row =>
        row.id === candidate.id && row.status === "running" && row.fence > candidate.fence &&
        row.assignedTo?.toHexString() === identity,
      ));
      const observations = await waitFor(() => {
        const rows = Array.from(conn.db.workerMemories.iter()).filter(row =>
          row.roomId === claimed.roomId && row.branchId === claimed.branchId && row.residentId === claimed.residentId,
        );
        return rows.some(row => row.sourceId === claimed.sourceId) ? rows : undefined;
      });
      const trigger = observations.find(row => row.sourceId === claimed.sourceId && row.kind === "human_assumption")
        ?? observations.find(row => row.sourceId === claimed.sourceId)!;
      const records = observations.map(row => ({ ...row, observedAtMs: Number(row.observedAt.microsSinceUnixEpoch / 1000n) }));
      const selected = retrieveMemories(records, {
        roomId: claimed.roomId, branchId: claimed.branchId, residentId: claimed.residentId,
        observedSourceIds: new Set(records.map(row => row.sourceId)),
      }, trigger.content, { nowMs: Date.now(), limit: 12 });
      // Always include the triggering observation, even when older memories rank above it.
      const chosenIds = new Set(selected.map(row => row.id));
      chosenIds.add(trigger.id);
      if (stopped) return;
      const reflection = await reflectMemory({
        residentId: claimed.residentId, sourceId: claimed.sourceId, signal: options.signal,
        memories: records.filter(row => chosenIds.has(row.id)).map(row => ({
          id: row.id, sourceId: row.sourceId, content: row.content, kind: row.kind,
          importance: row.importance, observedAtMs: row.observedAtMs,
        })),
      });
      if (stopped) return;
      const current = Array.from(conn.db.workerJobs.iter()).find(row => row.id === claimed.id);
      if (!current || current.fence !== claimed.fence || current.status !== "running" ||
        current.assignedTo?.toHexString() !== identity || current.leaseUntilMs <= BigInt(Date.now())) {
        throw new Error("Reflection discarded because its job lease changed or expired.");
      }
      await conn.reducers.completeReflection({
        jobId: claimed.id, fence: claimed.fence,
        content: reflection.content, importance: reflection.importance,
      });
      retryAt.delete(claimed.id);
      log(`Completed reflection ${claimed.id}.`);
    }

    async function tick(conn: DbConnection) {
      if (stopped || busy) return;
      const now = Date.now();
      const candidate = Array.from(conn.db.workerJobs.iter()).find(row =>
        (row.status === "queued" || (row.status === "running" && row.leaseUntilMs <= BigInt(now))) &&
        (retryAt.get(row.id) ?? 0) <= now,
      );
      if (!candidate) return;
      busy = true;
      try { await processJob(conn, candidate); }
      catch {
        // Never log provider errors: they may contain prompts or customer source content.
        retryAt.set(candidate.id, Date.now() + 125_000);
        log(`Reflection ${candidate.id} was not committed; it can retry after its lease expires.`);
      } finally { busy = false; }
    }

    connection = DbConnection.builder().withUri(options.uri).withDatabaseName(options.database).withToken(options.token)
      .onConnect((conn, workerIdentity, issuedToken) => {
        identity = workerIdentity.toHexString();
        void options.onIdentity(identity, issuedToken).then(() => {
          if (stopped) return;
          conn.subscriptionBuilder().onApplied(() => {
            if (stopped) return;
            log("Worker subscribed. Waiting for room authorization and reflection jobs.");
            timer = setInterval(() => { void tick(conn); }, 1_000);
            void tick(conn);
          }).onError(() => finish(new Error("Worker subscriptions failed."))).subscribe([
            "SELECT * FROM worker_jobs", "SELECT * FROM worker_memories",
          ]);
        }).catch(() => finish(new Error("Unable to persist the worker identity token.")));
      })
      .onConnectError(() => finish(new Error("Worker could not connect to SpacetimeDB.")))
      .onDisconnect(() => finish(new Error("Worker disconnected from SpacetimeDB.")))
      .build();
  });
}
