import {recipientEmail} from './agents/report-markdown';
export const signupUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function parseSignup(body: Record<string, unknown>) {
  const email = recipientEmail(body.email);
  if (body.mode !== 'founder' && body.mode !== 'policy') throw new Error('Choose Product or Policy.');
  if (typeof body.requestId !== 'string' || !signupUuid.test(body.requestId)) throw new Error('Please retry this signup.');
  if (body.productUpdates !== undefined && typeof body.productUpdates !== 'boolean') throw new Error('Please check your update preference.');
  return {email, mode: body.mode, requestId: body.requestId, productUpdates: body.productUpdates === true};
}
