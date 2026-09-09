import assert from 'node:assert/strict';
import test from 'node:test';
import {conversationSchedule,coverage,pairKey} from '../src/lib/agents/coverage';
import {simulationJsonl} from '../src/lib/agents/export';
import {generateConversation} from '../src/lib/agents';

test('12 residents cover 66 distinct pairs with everyone included in each round',()=>{
  const ids=Array.from({length:12},(_,i)=>String(i));const schedule=conversationSchedule(ids);
  assert.equal(schedule.length,66);assert.equal(new Set(schedule.map(p=>pairKey(...p))).size,66);
  for(let i=0;i<66;i+=6) assert.equal(new Set(schedule.slice(i,i+6).flat()).size,12);
  assert.ok(schedule.every(([a,b])=>a!==b));
  const population=ids.map(id=>({id}));const done=schedule.map(participantIds=>({participantIds}));
  assert.equal(coverage(population,done).complete,true);
  assert.deepEqual(coverage(population,done.slice(0,6)).nextPair,schedule[6]);
  assert.equal(coverage(population,[done[0],{participantIds:[...done[0].participantIds].reverse() as [string,string]}]).completed,1);
});

test('JSONL retains all 66 conversations and messages beyond the old 20-entry limit',()=>{
  const conversations=conversationSchedule(Array.from({length:12},(_,i)=>String(i))).map((participantIds,round)=>({id:String(round),participantIds,round:round+1,title:'Pair',model:'test',kind:'simulated' as const,messages:participantIds.map(actorId=>({actorId,text:'Line one\nLine two',sourceIds:[]})),memories:[]}));
  const lines=simulationJsonl({id:'test',brief:{},createdAt:'today',population:[],evidence:[],conversations}).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(lines.filter(l=>l.type==='message').length,132);
  assert.equal(lines.filter(l=>l.type==='conversation').length,66);
  assert.ok(!lines.some(l=>'owner' in l));
});

test('both actors reflect after the reply and keep private opinion history separate',async()=>{
  const originalFetch=globalThis.fetch;const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-placeholder';
  const contexts:any[]=[];
  globalThis.fetch=async(_url,options)=>{
    const body=JSON.parse(String(options?.body));const data=JSON.parse(body.contents[0].parts[0].text);contexts.push(data);
    const reflection=!!body.generationConfig.responseJsonSchema.properties.before;
    const answer=reflection?{before:'Skeptical',after:'Still skeptical',reason:'No new evidence.',sourceIds:[]}:{message:'I need evidence before changing my mind.',sourceIds:[]};
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]});
  };
  try {
    const persona=(id:string)=>({id,name:id,role:'Founder',goal:'Understand',background:'Fictional',concerns:[],sourceIds:[],assumptions:[]});
    const result=await generateConversation({brief:{mode:'founder',productName:'Test',productUrl:'https://example.com',decision:'Which audience?',audience:'Founders',constraint:'Hypotheses',source:'local_form'},publicChanges:['User change: Charge a monthly subscription instead of a one-time fee.'],participants:[persona('a'),persona('b')],memories:[{agentId:'a',text:'Opinion update: private-a',kind:'reflection',sourceIds:[]},{agentId:'b',text:'Opinion update: private-b',kind:'reflection',sourceIds:[]}]});
    assert.equal(contexts.length,4);assert.ok(contexts.every(c=>c.publicChanges[0].includes('monthly subscription')));assert.equal(contexts[2].publicConversation.length,2);assert.equal(contexts[3].publicConversation.length,2);
    for(const c of contexts){assert.ok(c.ownMemories.every((m:any)=>!m.text.includes(c.actor.id==='a'?'private-b':'private-a')));}
    assert.equal(contexts[0].currentOpinion,'Opinion update: private-a');
    assert.equal(result.memories.length,2);assert.match(result.memories[0].text,/Still skeptical/);
  } finally {globalThis.fetch=originalFetch;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
