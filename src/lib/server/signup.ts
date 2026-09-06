import 'server-only';
import {ApiError} from './simulation-store';
import type {parseSignup} from '../signup-input';

/** Private lead capture independent of inference configuration; never sends email. */
export async function saveSignup(owner: string, input: ReturnType<typeof parseSignup>) {
  const uri = process.env.SPACETIMEDB_URI?.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
  const database = process.env.SPACETIMEDB_DATABASE;
  const token = process.env.SPACETIMEDB_SERVICE_TOKEN;
  if (!uri || !database || !token) throw new ApiError(503, 'Email signup is temporarily unavailable. You can continue without it.');
  let response: Response;
  try {
    response = await fetch(`${uri}/v1/database/${encodeURIComponent(database)}/call/capture_signup`, {
      method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify([input.requestId, owner, input.email, input.mode, input.productUpdates]),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError(503, 'We could not confirm your signup. Please retry or continue without it.'); }
  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes('Signup request conflict')) throw new ApiError(409, 'Your signup changed. Please submit it again.');
    throw new ApiError(503, 'Email signup is temporarily unavailable. You can continue without it.');
  }
  return {saved: true, message: 'Your email has been saved.'};
}
