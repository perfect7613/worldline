import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyReportFindings} from '../src/lib/agents';
import {reportMarkdown} from '../src/lib/agents/report-markdown';
import type {ReportFinding} from '../src/lib/agents/types';

const sources = [{id:'pricing',title:'Pricing page',url:'https://example.com/pricing',excerpt:'The starter plan costs ₹999 per month. A free trial lasts 7 days.'}];
const claim: ReportFinding = {title:'Starter pricing',detail:'The listed starter plan costs ₹999 per month.',kind:'source_supported',sourceIds:['pricing'],conversationIds:[],evidence:[{sourceId:'pricing',quote:'The starter plan costs ₹999 per month.'}]};

test('fabricated or wrong-source quotes cannot establish support', async () => {
  const result = await verifyReportFindings([{...claim,evidence:[{sourceId:'pricing',quote:'Free forever'},{sourceId:'unknown',quote:sources[0].excerpt}]}],sources);
  assert.deepEqual(result[0].evidence,[]);
  assert.equal(result[0].verification?.status,'insufficient');
});

test('a separate checker sees source passages, preserves contradiction, and fails closed', async () => {
  const originalFetch=globalThis.fetch;
  const originalKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-not-a-real-key';
  let calls=0;
  try {
    globalThis.fetch=async (_url,init) => {
      calls++;
      const body=JSON.parse(String(init?.body));
      assert.ok(body.systemInstruction.parts[0].text.includes('Independently audit'));
      assert.ok(body.contents[0].parts[0].text.includes(sources[0].excerpt));
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({checks:[{index:0,status:'contradicted',reason:'The claim conflicts with the source.'}]})}]}}]});
    };
    const result=await verifyReportFindings([claim],sources);
    assert.equal(calls,1);
    assert.equal(result[0].verification?.status,'contradicted');
    globalThis.fetch=async () => new Response('',{status:503});
    const unavailable=await verifyReportFindings([claim],sources);
    assert.equal(unavailable[0].verification?.status,'insufficient');
  } finally {
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=originalKey;
  }
});

test('simulated claims retain their label and markdown shows passages, links and readable discussions', async () => {
  const finding={...claim,kind:'simulation_hypothesis' as const,conversationIds:['c-private-hash']};
  const findings=await verifyReportFindings([finding],sources);
  assert.equal(findings[0].verification,undefined);
  const markdown=reportMarkdown({title:'Report',summary:'Summary',findings,sources,conversationReferences:[{id:'c-private-hash',label:'Priya & Arjun · Conversation 1'}],uncertainties:[],nextSteps:[],kind:'simulated',model:'test',disclaimer:'Simulated'});
  assert.ok(markdown.includes('> The starter plan costs ₹999 per month.'));
  assert.ok(markdown.includes('[Pricing page](<https://example.com/pricing>)'));
  assert.ok(markdown.includes('Priya & Arjun'));
  assert.ok(!markdown.includes('c-private-hash'));
  assert.ok(markdown.includes('Simulated reaction'));
});

test('a completed comparison can generate a report without conversations; unknown comparison refs fail', async () => {
  const {generateReport}=await import('../src/lib/agents');
  const originalFetch=globalThis.fetch, originalKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-not-a-real-key';
  const comparison={id:'comparison-id',change:'Monthly billing',createdAt:'2026-09-06',status:'complete' as const,total:1,completed:1,model:'test',disclaimer:'Simulated',results:[{agentId:'mira',name:'Priya',role:'Founder',baseline:{decision:'Wait',reason:'Cost',tradeoff:'Delay',sourceIds:[]},changed:{decision:'Try',reason:'Affordable',tradeoff:'Renewal',sourceIds:[]}}]};
  const input={brief:{mode:'founder' as const,productName:'Tool',productUrl:'https://example.com',source:'local_form' as const,decision:'Price',audience:'Founders',constraint:'Budget'},population:[],conversations:[],comparison};
  let cited='mira';
  try {
    globalThis.fetch=async (_url,init)=>{
      const request=JSON.parse(String(init?.body));
      const data=JSON.parse(request.contents[0].parts[0].text);
      assert.equal(data.comparison.results[0].agentId,'mira');
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({title:'Comparison report',summary:'A hypothetical change',findings:[{title:'Cost',detail:'May help',kind:'simulation_hypothesis',sourceIds:[],conversationIds:[],comparisonAgentIds:[cited],evidence:[]}],uncertainties:['Synthetic'],nextSteps:['Interview']})}]}}]});
    };
    const report=await generateReport(input);
    assert.equal(report.comparison?.id,'comparison-id');
    assert.deepEqual(report.findings[0].comparisonAgentIds,['mira']);
    assert.ok(reportMarkdown(report).includes('Comparison perspectives: Priya'));
    cited='unknown';
    await assert.rejects(generateReport(input),/supporting references/);
    await assert.rejects(generateReport({...input,comparison:undefined}),/completed comparison pair/);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=originalKey;
  }
});
