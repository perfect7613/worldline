import {createHash, randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {parseSignup, signupUuid} from '@/lib/signup-input';
import {saveSignup} from '@/lib/server/signup';
import {ApiError, takeBudget} from '@/lib/server/simulation-store';
import {failure, readJson, success} from '@/lib/server/simulation-http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let owner: string | undefined;
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError(403, 'Open this action from the app.');
    const body = await readJson(request);
    let input: ReturnType<typeof parseSignup>;
    try { input = parseSignup(body); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Please check your signup.'); }
    const cookie = (await cookies()).get('lkb-owner')?.value;
    owner = cookie && signupUuid.test(cookie) ? cookie : randomUUID();
    const ip = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'local';
    const hash = createHash('sha256').update(ip).digest('hex');
    await takeBudget('signup:global', 1000);
    await takeBudget(`signup:ip:${hash}`, 20);
    await takeBudget(`signup:owner:${owner}`, 10);
    return success(await saveSignup(owner, input), owner);
  } catch (error) {
    const response = failure(error instanceof ApiError ? error : new ApiError(503, 'Email signup is temporarily unavailable. You can continue without it.'));
    // Preserve identity on an uncertain database response so a retry stays idempotent.
    if (owner) response.cookies.set('lkb-owner', owner, {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 86400});
    return response;
  }
}
