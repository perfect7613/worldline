import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Only globally routed unicast IPv6. Reject mapped IPv4 and special scopes.
    return /^[23][0-9a-f]{3}:/.test(lower) && !lower.startsWith("2001:db8:");
  }
  return false;
}

export function normalizeProductUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a public product website URL.");
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
    (url.port && !["80", "443"].includes(url.port))) throw new Error("Use a public HTTP or HTTPS website without credentials or custom ports.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    (!host.includes(".") && !isIP(host)) || (isIP(host) && !isPublicAddress(host)))
    throw new Error("Private network addresses cannot be researched.");
  url.hash = "";
  return url;
}

export async function validatePublicHost(url: URL) {
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address)))
    throw new Error("The website must resolve to public network addresses.");
}

export async function extractProduct(url: URL, apiKey: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.toString(), formats: ["markdown"], onlyMainContent: true }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Website extraction failed (${response.status}).`);
  const result = await response.json() as {
    success?: boolean;
    data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
  };
  if (!result.success || !result.data?.markdown?.trim()) throw new Error("The website returned no readable content.");
  return {
    status: "extracted" as const,
    source: { url: url.toString(), title: result.data.metadata?.title ?? url.hostname,
      capturedAt: new Date().toISOString(), kind: "website_capture" as const },
    markdown: result.data.markdown.slice(0, 60_000),
    reviewRequired: true,
  };
}
