import "server-only";
import { chromium, errors, type Browser } from "playwright-core";
import { normalizeProductUrl, validatePublicHost } from "./ingestion";

const SESSION_API = "https://api.browserbase.com/v1/sessions";
const CAPTURE_TIMEOUT_MS = 45_000;

/** Read-only website capture; credentials and session URLs never leave the server. */
export async function extractWithBrowserbase(input: URL) {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
  if (!apiKey || !projectId) throw new Error("Browser research is not configured.");

  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  const remaining = () => Math.max(1, deadline - Date.now());
  const headers = { "X-BB-API-Key": apiKey, "Content-Type": "application/json" };
  let browser: Browser | undefined;
  let sessionId: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;

  const capture = async () => {
    const url = normalizeProductUrl(input.toString());
    await validatePublicHost(url);
    const sessionResponse = await fetch(SESSION_API, {
      method: "POST", headers,
      // Browserbase's minimum session timeout is 60s; the application deadline is 45s.
      body: JSON.stringify({ projectId, timeout: 60, keepAlive: false }),
      signal: AbortSignal.timeout(remaining()),
    });
    if (!sessionResponse.ok) throw new Error("Could not start browser research.");
    const session = await sessionResponse.json() as { id?: string; connectUrl?: string };
    if (!session.id || !session.connectUrl) throw new Error("Browser research returned an invalid session.");
    sessionId = session.id;
    if (expired) throw new Error("Browser research timed out.");
    browser = await chromium.connectOverCDP(session.connectUrl, { timeout: remaining() });
    if (expired) { await browser.close(); throw new Error("Browser research timed out."); }
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    context.setDefaultTimeout(remaining());
    // No WebSockets are needed to read website copy. They otherwise bypass HTTP routing.
    await context.routeWebSocket("**/*", socket => socket.close());
    let sourceUrl = url.toString();
    await context.route("**/*", async route => {
      try {
        const request = route.request();
        if (expired || !["GET", "HEAD"].includes(request.method())) return await route.abort();
        let destination = normalizeProductUrl(request.url());
        // Intercepted browser redirects are not guaranteed to invoke route again.
        // Fetch without redirects, validating each destination before following it.
        for (let hop = 0; hop < 6; hop++) {
          await validatePublicHost(destination);
          if (expired) return await route.abort();
          const response = await route.fetch({ url: destination.toString(), maxRedirects: 0, timeout: remaining() });
          const location = response.headers().location;
          if (response.status() >= 300 && response.status() < 400 && location) {
            await response.dispose();
            destination = normalizeProductUrl(new URL(location, destination).toString());
            continue;
          }
          if (request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame()) {
            sourceUrl = destination.toString();
          }
          await route.fulfill({ response });
          await response.dispose();
          return;
        }
        await route.abort();
      } catch {
        // Includes DNS failures, private addresses, non-HTTP schemes and redirect loops.
        await route.abort().catch(() => undefined);
      }
    });
    const page = await context.newPage();
    let response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: remaining() });
    // Commit the validated redirect target as the document URL so relative assets
    // resolve against its real path instead of the original landing address.
    if (sourceUrl !== page.url()) {
      response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: remaining() });
    }
    if (!response || response.status() >= 400) throw new Error("The website could not be read.");
    const finalUrl = normalizeProductUrl(page.url());
    await validatePublicHost(finalUrl);
    // Give client-rendered pages a bounded opportunity to finish loading copy.
    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(5_000, remaining()) });
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error;
    }
    const markdown = (await page.locator("body").innerText({ timeout: remaining() })).trim().slice(0, 6_000);
    if (!markdown) throw new Error("The website returned no readable content.");
    return {
      status: "extracted" as const,
      source: { url: sourceUrl, title: (await page.title()).slice(0, 300) || finalUrl.hostname,
        capturedAt: new Date().toISOString(), kind: "browser_capture" as const },
      markdown,
      reviewRequired: true,
    };
  };

  try {
    return await Promise.race([
      capture(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error("Browser research timed out.")); }, CAPTURE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Playwright errors can contain the authenticated CDP URL. Never return them.
    throw new Error(expired ? "Browser research timed out." : "Browser research could not capture this website.");
  } finally {
    if (timer) clearTimeout(timer);
    expired = true;
    const cleanup = [];
    if (browser) cleanup.push(browser.close().catch(() => undefined));
    if (sessionId) cleanup.push(fetch(`${SESSION_API}/${encodeURIComponent(sessionId)}`, {
      method: "POST", headers,
      body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }),
      signal: AbortSignal.timeout(3_000),
    }).catch(() => undefined));
    // Automatic server expiry remains a final backstop if provider cleanup fails.
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([Promise.allSettled(cleanup), new Promise(resolve => {
      cleanupTimer = setTimeout(resolve, 3_000);
    })]);
    if (cleanupTimer) clearTimeout(cleanupTimer);
  }
}
