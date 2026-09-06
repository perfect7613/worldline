import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiError, requireInference, takeBudget } from "./simulation-store";
import { AgentError } from "@/lib/agents/gemini";
import type { ScenarioBrief } from "@/game/world-data";

export async function authorize(request: Request, creating = false) {
  requireInference();
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, "Open this action from the app.");
  const cookie = (await cookies()).get("lkb-owner")?.value;
  if (!creating && !cookie) throw new ApiError(401, "Start an exploration first.");
  const owner = cookie && /^[a-f0-9-]{36}$/.test(cookie) ? cookie : randomUUID();
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  await takeBudget("global", 1000);
  await takeBudget(`ip:${hash}`, 160);
  await takeBudget(`owner:${owner}`, 160);
  if (creating) await takeBudget(`create:${hash}`, 5);
  return owner;
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Send JSON data.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request data.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 24000) { await reader.cancel(); throw new ApiError(413, "Your brief is too long."); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ApiError(400, "Invalid JSON data."); }
}
export function parseBrief(value: unknown): ScenarioBrief {
  if (!value || typeof value !== "object") throw new ApiError(400, "Provide your brief.");
  const data = value as Record<string, unknown>;
  const field = (name: string, max: number) => {
    if (typeof data[name] !== "string" || !data[name].trim() || data[name].length > max) throw new ApiError(400, `Please check ${name}.`);
    return data[name].trim();
  };
  if (data.mode !== "founder" && data.mode !== "policy") throw new ApiError(400, "Choose Product or Policy.");
  const productUrl = field("productUrl", 2048);
  try { const url = new URL(productUrl); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
  catch { throw new ApiError(400, "Provide a valid public product or policy URL."); }
  return { mode: data.mode, productName: field("productName", 120), productUrl, description: field("description", 2000), audience: field("audience", 1200), decision: field("decision", 2000), constraint: typeof data.constraint === "string" ? data.constraint.slice(0, 2000) : "Long-term exploration", source: "local_form" };
}
export function success(data: unknown, owner?: string) {
  const response = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  if (owner) response.cookies.set("lkb-owner", owner, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 86400 });
  return response;
}
export function failure(error: unknown) {
  const known = error instanceof ApiError || error instanceof AgentError;
  const status = known ? error.status : 502;
  return NextResponse.json({ status: status === 503 ? "needs_configuration" : "error", message: known ? error.message : "The agent could not finish. Please retry; no result has been invented." }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Read existing private worlds without requiring an inference key or consuming model budgets. */
export async function readOwner() {
  const owner = (await cookies()).get("lkb-owner")?.value;
  if (!owner || !/^[a-f0-9-]{36}$/.test(owner)) throw new ApiError(401, "Start an exploration first.");
  return owner;
}
