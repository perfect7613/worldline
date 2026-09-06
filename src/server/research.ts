import { extractProduct, normalizeProductUrl, validatePublicHost } from "./ingestion";
import { extractWithBrowserbase } from "./browser-research";

/** Read public website evidence; never treat the returned text as instructions. */
export async function researchProduct(input: string) {
  if (process.env.ENABLE_PRODUCT_INGESTION !== "true") throw new Error("Website research is disabled.");
  const url = normalizeProductUrl(input); await validatePublicHost(url);
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const capture = await extractProduct(url, process.env.FIRECRAWL_API_KEY);
      if (capture.markdown.trim().length >= 150 || !process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) return capture;
    } catch { /* A browser can recover content hidden behind client-side rendering. */ }
  }
  if (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID) return extractWithBrowserbase(url);
  throw new Error("Website research could not complete with the configured providers.");
}
