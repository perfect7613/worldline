import assert from 'node:assert/strict';
import test from 'node:test';
import {reportEmailTemplate} from '../src/lib/email/report-template';
import {reportMarkdown} from '../src/lib/agents/report-markdown';
import type {AgentReport} from '../src/lib/agents/types';
const base:AgentReport={title:'Report',summary:'Summary',findings:[],sources:[],uncertainties:[],nextSteps:[],model:'test',kind:'simulated',disclaimer:'Simulated'};
test('report exports omit optional comparison and customer sections when not provided',()=>{
  for(const text of [reportMarkdown(base),...Object.values(reportEmailTemplate(base))]) {
    assert.ok(!text.toLowerCase().includes('original vs. change'));
    assert.ok(!text.toLowerCase().includes('customer responses (optional)'));
  }
});
test('comparison and optional user responses export names, tradeoffs and disclosure without internal IDs',()=>{
  const report:AgentReport={...base,comparison:{id:'comparison-secret-id',change:'Offer monthly billing',createdAt:'2026-09-06',status:'complete',completed:1,total:1,model:'test',disclaimer:'Paired simulated assessments; not measured conversion.',results:[{agentId:'agent-secret-id',name:'Priya',role:'Founder',baseline:{decision:'Wait',reason:'Annual expense is too high',tradeoff:'Misses features',sourceIds:[]},changed:{decision:'Try it',reason:'Monthly cost fits',tradeoff:'May cancel later',sourceIds:[]}}]},customerResponses:[{id:'response-secret-id',comparisonId:'comparison-secret-id',text:'A customer asked for monthly billing <script>',createdAt:'2026-09-06',kind:'user_reported'}]};
  for(const output of [reportMarkdown(report),...Object.values(reportEmailTemplate(report))]) {
    for(const expected of ['Priya','Wait','Try it','May cancel later','not measured conversion','not independently verified','A customer asked']) assert.ok(output.includes(expected),expected);
    for(const id of ['comparison-secret-id','agent-secret-id','response-secret-id']) assert.ok(!output.includes(id));
  }
  assert.ok(!reportEmailTemplate(report).html.includes('<script>'));
});
