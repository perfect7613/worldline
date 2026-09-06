import assert from 'node:assert/strict';
import test from 'node:test';
import {reportEmailTemplate} from '../src/lib/email/report-template';
test('HTML report escapes untrusted content and does not link unsafe URLs',()=>{
  const result=reportEmailTemplate({title:'<img src=x onerror=alert(1)>',summary:'A & B',findings:[{title:'<script>bad</script>',detail:'"Quoted"',kind:'simulation_hypothesis',sourceIds:['source-1'],conversationIds:['pair-1']}],uncertainties:['Unknown <risk>'],nextSteps:['Talk to people'],sources:[{id:'source-1',title:'Unsafe link',url:'javascript:alert(1)',excerpt:'<b>claim</b>'}],model:'test',kind:'simulated',disclaimer:'Fictional perspectives.'});
  assert.ok(!result.html.includes('<script>'));assert.ok(!result.html.includes('<img'));assert.ok(!result.html.includes('href="javascript:'));
  assert.ok(result.html.includes('&lt;img'));assert.ok(result.html.includes('A &amp; B'));
  for(const expected of ['SIMULATED PERSPECTIVE','Agent discussion','Still worth asking','Your next steps','Fictional perspectives.'])assert.ok(result.html.includes(expected));
  assert.ok(!result.html.includes('pair-1'));assert.ok(!result.text.includes('pair-1'));assert.ok(result.text.includes('Simulated perspective'));assert.ok(!result.text.includes('<table'));
});

test('email shows exact source links, check status and readable conversation titles',()=>{
  const report=reportEmailTemplate({title:'Decision',summary:'Summary',findings:[{title:'Price',detail:'Pricing claim',kind:'source_supported',sourceIds:['source-uuid'],conversationIds:['conversation-uuid'],evidence:[{sourceId:'source-uuid',quote:'The plan costs ₹999.'}],verification:{status:'insufficient',reason:'No evidence for the claimed adoption rate.'}}],conversationReferences:[{id:'conversation-uuid',label:'Priya & Arjun · Conversation 1'}],sources:[{id:'source-uuid',title:'Pricing page',url:'https://example.com/pricing',excerpt:'The plan costs ₹999.'}],uncertainties:[],nextSteps:[],model:'test',kind:'simulated',disclaimer:'Synthetic'});
  assert.ok(report.html.includes('INSUFFICIENT EVIDENCE'));
  assert.ok(report.html.includes('href="https://example.com/pricing"'));
  assert.ok(report.html.includes('The plan costs ₹999.'));
  assert.ok(report.html.includes('Priya &amp; Arjun'));
  assert.ok(!report.html.includes('SOURCE-SUPPORTED'));
  for(const output of [report.html,report.text]) {
    assert.ok(!output.includes('source-uuid'));
    assert.ok(!output.includes('conversation-uuid'));
    assert.ok(output.includes('No evidence for the claimed adoption rate.'));
  }
});
