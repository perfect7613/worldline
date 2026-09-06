import assert from 'node:assert/strict';
import test from 'node:test';
import {generateJSON, list, obj, str, AgentError} from '../src/lib/agents/gemini';

test('simplified provider grammar still rejects responses outside application bounds', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-placeholder';
  const schema = obj({ names: list(str(3), 2, 2) });
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.generationConfig.responseJsonSchema.properties.names.maxItems, undefined);
    assert.equal(body.generationConfig.responseJsonSchema.properties.names.items.maxLength, undefined);
    assert.match(body.systemInstruction.parts[0].text, /"maxItems":2/);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({names:['too long']})}]}}]});
  };
  try {
    await assert.rejects(generateJSON('Produce two short names.', {}, schema), (error: unknown) => error instanceof AgentError && error.code === 'invalid_response');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
});
