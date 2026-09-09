import 'server-only';
import {createHash} from 'node:crypto';
import {ApiError} from './simulation-store';
import {reportEmailTemplate} from '@/lib/email/report-template';
import {reportMarkdown} from '@/lib/agents/report-markdown';
import type {AgentReport} from '@/lib/agents/types';
export async function emailReport(sessionId:string,email:string,report:AgentReport) {
  const key=process.env.RESEND_API_KEY?.trim();const from=process.env.EMAIL_FROM?.trim();
  if(!key || !from) throw new ApiError(503,'Email delivery needs RESEND_API_KEY and EMAIL_FROM on the server.');
  const markdown=reportMarkdown(report);
  const {html,text}=reportEmailTemplate(report);
  // Stable across network retries; a changed report or recipient is a new delivery.
  const idempotency=createHash('sha256').update(JSON.stringify([sessionId,email,from,markdown,html,text])).digest('hex');
  let response:Response;
  try {
    response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`report/${idempotency}`},body:JSON.stringify({from,to:[email],subject:'Your Log kya bolenge decision report',html,text,attachments:[{filename:'log-kya-bolenge-report.md',content:Buffer.from(markdown,'utf8').toString('base64')}] }),signal:AbortSignal.timeout(15000)});
  } catch {throw new ApiError(504,'Email confirmation timed out. Retry with the same address; duplicate requests are protected for 24 hours.');}
  if(!response.ok) {
    if(response.status===429) throw new ApiError(429,'Email sending is busy. Please try again shortly.');
    if(response.status===401 || response.status===403) throw new ApiError(503,'Resend rejected this sender or recipient. Check the API key and verify the sending domain; test senders have recipient restrictions.');
    if(response.status===409) throw new ApiError(409,'This email request is still processing. Retry with the same address shortly.');
    throw new ApiError(502,'Resend could not accept this email. Please try again.');
  }
  const result=await response.json() as {id?:string};
  if(!result.id) throw new ApiError(502,'Email delivery could not be confirmed. Retry with the same address.');
  return {status:'accepted',id:result.id,message:'Resend accepted your report for delivery. Check your inbox and spam folder.'};
}
