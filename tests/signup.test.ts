import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSignup} from '../src/lib/signup-input';
const base = {email: ' founder@example.com ', mode: 'founder', requestId: 'c346dd7e-e90c-469d-a6fa-59eb5df7fe82'};
test('signup captures a valid address without silently opting into updates', () => {
  assert.deepEqual(parseSignup(base), {...base, email: 'founder@example.com', productUpdates: false});
  assert.equal(parseSignup({...base, mode: 'policy', productUpdates: true}).productUpdates, true);
});
test('signup rejects invalid addresses, forged preference types and non-UUID retry identifiers', () => {
  for (const change of [{email:'a@b.com\r\nBcc:other@example.com'}, {email:'a@example.com,b@example.com'}, {mode:'other'}, {productUpdates:'true'}, {requestId:"x' OR 1=1"}]) {
    assert.throws(() => parseSignup({...base, ...change}));
  }
});
