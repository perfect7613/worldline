import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProductUrl, isPublicAddress, extractProduct } from "../src/server/ingestion";

test("product URLs reject private networks, credentials and unsupported protocols", () => {
  for (const input of ["localhost", "http://127.0.0.1", "http://2130706433", "http://169.254.169.254/latest/meta-data", "http://[::1]", "http://[::ffff:127.0.0.1]", "http://10.0.0.1", "ftp://example.com", "https://user:pass@example.com", "https://example.com:9000"])
    assert.throws(() => normalizeProductUrl(input), input);
  assert.equal(normalizeProductUrl("example.com/features#pricing").toString(), "https://example.com/features");
  assert.equal(isPublicAddress("192.168.1.1"), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});

test("capture preserves source provenance and review status; provider failures cannot become evidence", async () => {
  const mock = (async (_input: unknown, init: RequestInit) => {
    assert.equal(JSON.parse(init.body as string).formats[0], "markdown");
    return Response.json({ success: true, data: { markdown: "A product claim", metadata: { title: "Product" } } });
  }) as typeof fetch;
  const capture = await extractProduct(new URL("https://example.com"), "test-key", mock);
  assert.equal(capture.source.kind, "website_capture");
  assert.equal(capture.reviewRequired, true);
  assert.equal(capture.markdown, "A product claim");
  await assert.rejects(extractProduct(new URL("https://example.com"), "test-key", (async () => Response.json({ success: false })) as typeof fetch));
});
