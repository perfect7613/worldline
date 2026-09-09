import assert from 'node:assert/strict';
import test from 'node:test';
import {recipientEmail,reportMarkdown} from '../src/lib/agents/report-markdown';
test('report delivery accepts one address and rejects header injection and recipient lists',()=>{
  assert.equal(recipientEmail(' founder+report@example.com '),'founder+report@example.com');
  for(const bad of ['a@example.com,b@example.com','Name <a@example.com>','a@example.com\r\nBcc: b@example.com','a@localhost','.a@example.com','a..b@example.com','a@-bad.com','a'.repeat(65)+'@example.com',null])assert.throws(()=>recipientEmail(bad));
});
test('emailed and downloaded reports preserve findings, source references and hypothesis disclosure',()=>{
  const text=reportMarkdown({title:'Decision',summary:'Summary',findings:[{title:'Finding',detail:'A possible objection',kind:'simulation_hypothesis',sourceIds:['source-1'],conversationIds:['pair-1']}],uncertainties:['Needs interviews'],nextSteps:['Ask customers'],sources:[{id:'source-1',title:'Product',url:'https://example.com',excerpt:'A source claim'}],model:'test',kind:'simulated',disclaimer:'Fictional stakeholders; not a forecast.'});
  for(const expected of ['Simulated reaction','Product','Agent discussion','Needs interviews','Ask customers','https://example.com','not a forecast'])assert.ok(text.includes(expected));
  assert.ok(!text.includes("pair-1"));
});
