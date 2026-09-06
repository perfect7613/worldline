export async function GET() {
  return Response.json({
    database: process.env.NEXT_PUBLIC_SPACETIMEDB_URI && process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE
      ? "configured" : "needs_configuration",
    ingestion: process.env.ENABLE_PRODUCT_INGESTION !== "true" ? "disabled"
      : (process.env.FIRECRAWL_API_KEY || (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID)) ? "configured" : "needs_configuration",
    inference: process.env.ENABLE_AGENT_INFERENCE === "true" && process.env.GEMINI_API_KEY && process.env.SPACETIMEDB_URI && process.env.SPACETIMEDB_DATABASE && process.env.SPACETIMEDB_SERVICE_TOKEN ? "configured" : "needs_configuration",
    memoryEmbeddings: process.env.OPENAI_API_KEY ? "configured" : "lexical_fallback",
    browser: process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID ? "configured" : "needs_configuration",
    emailMode: /@resend\.dev>?$/.test(process.env.EMAIL_FROM?.trim() ?? "") ? "testing" : "custom_domain",
    email: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "configured" : "needs_configuration",
    // Configuration is not a health check or a claim that a provider is reachable.
  }, { headers: { "Cache-Control": "no-store" } });
}
