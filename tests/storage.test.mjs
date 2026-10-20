import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../js/storage.js',import.meta.url),'utf8');
let moduleId=0;
const freshStorage=()=>import(`data:text/javascript;base64,${Buffer.from(source+`\n// storage instance ${moduleId++}`).toString('base64')}`);
const makeAttempt=id=>({id,phase:'active',startedAt:1,finishedAt:null,questions:[{id:'q',kind:'number',answer:'2'}],responses:{q:{text:'',score:0}},result:null});
const clone=structuredClone;

// Requests issued from an onsuccess callback remain in the same transaction;
// read/write transactions run serially, as IndexedDB requires.
function memoryIndexedDb(){
  const rows=new Map(),transactions=[];let running=false;
  const db={transaction(){
    const requests=[];let queued=false;
    const transaction={objectStore:()=>({
      get:id=>request(()=>clone(rows.get(id))),getAll:()=>request(()=>clone([...rows.values()])),
      put:value=>request(()=>{rows.set(value.id,clone(value));return value.id;}),delete:id=>request(()=>rows.delete(id))
    })};
    function request(run){const req={};requests.push({run,req});if(!queued){queued=true;transactions.push(pump);schedule();}return req;}
    function pump(){const next=requests.shift();if(next){queueMicrotask(()=>{next.req.result=next.run();next.req.onsuccess?.();pump();});}else{transaction.oncomplete?.();running=false;schedule();}}
    return transaction;
  }};
  function schedule(){if(!running&&transactions.length){running=true;queueMicrotask(transactions.shift());}}
  return {rows,api:{open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request;}}};
}

async function harness(useIdb,run){
  const dom=new JSDOM('',{url:'https://code1430.example/'}),idb=memoryIndexedDb(),saved=new Map();
  for(const [key,value]of Object.entries({localStorage:dom.window.localStorage,indexedDB:useIdb?idb.api:undefined})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
  try{await run(await freshStorage(),await freshStorage(),idb.rows);}finally{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
}

for(const useIdb of [false,true])test(`attempt concurrency with ${useIdb?'IndexedDB':'localStorage fallback'}`,async t=>{
  await t.test('stale active tab cannot replace a newer answer or its recovery',()=>harness(useIdb,async(a,b)=>{
    const first=makeAttempt('active');await a.saveAttempt(first);
    const stale=clone((await b.listAttempts())[0]),conflicts=[];b.onAttemptConflict(value=>conflicts.push(value));
    first.responses.q.text='latest answer';await a.saveAttempt(first);
    stale.responses.q.text='stale answer';assert.equal(b.checkpoint(stale),false);assert.equal(await b.saveAttempt(stale),false);
    assert.equal((await a.listAttempts())[0].responses.q.text,'latest answer');
    assert.equal(conflicts.at(-1).current.responses.q.text,'latest answer');
  }));
  await t.test('a finished result survives stale saves and legacy unload recovery',()=>harness(useIdb,async(a,b)=>{
    const first=makeAttempt('finished');await a.saveAttempt(first);const stale=clone((await b.listAttempts())[0]);
    first.responses.q.text='2';first.phase='finished';first.finishedAt=123;first.result={mark:5,pending:0};await a.saveAttempt(first);
    stale.responses.q.text='wrong';assert.equal(await b.saveAttempt(stale),false);
    localStorage.setItem('code1430:recovery',JSON.stringify({...stale,storageVersion:undefined,updatedAt:Date.now()+999999}));
    const [latest]=await b.listAttempts();assert.equal(latest.phase,'finished');assert.equal(latest.result.mark,5);assert.equal(latest.responses.q.text,'2');
    assert.equal(b.checkpoint(stale),false);
  }));
  await t.test('debounced checkpoints survive saving an earlier snapshot',()=>harness(useIdb,async a=>{
    const live=makeAttempt('debounce');await a.saveAttempt(live);
    live.responses.q.text='first input';assert.equal(a.checkpoint(live),true);const earlier=clone(live);
    live.responses.q.text='latest input';assert.equal(a.checkpoint(live),true);const latest=clone(live);
    assert.equal((await a.listAttempts())[0].responses.q.text,'latest input');
    assert.equal(await a.saveAttempt(earlier,{checkpointed:true}),true);
    assert.equal((await a.listAttempts())[0].responses.q.text,'latest input','an earlier save must not delete the current recovery checkpoint');
    assert.equal(await a.saveAttempt(latest,{checkpointed:true}),true);
    assert.equal((await a.listAttempts())[0].responses.q.text,'latest input');
  }));
  await t.test('out-of-order saves in the same tab never roll answers back',()=>harness(useIdb,async a=>{
    const live=makeAttempt('order');await a.saveAttempt(live);
    live.responses.q.text='older';a.checkpoint(live);const older=clone(live);
    live.responses.q.text='newer';a.checkpoint(live);const newer=clone(live),conflicts=[];a.onAttemptConflict(value=>conflicts.push(value));
    const results=await Promise.all([a.saveAttempt(newer,{checkpointed:true}),a.saveAttempt(older,{checkpointed:true})]);
    assert.deepEqual(results,[true,false]);assert.equal((await a.listAttempts())[0].responses.q.text,'newer');assert.equal(conflicts.length,0);
  }));
  await t.test('another tab can restore the latest checkpoint before debounce saves it',()=>harness(useIdb,async(a,b)=>{
    const first=makeAttempt('restore-checkpoint');await a.saveAttempt(first);
    first.responses.q.text='unsaved input';a.checkpoint(first);const pending=clone(first),restored=clone((await b.listAttempts())[0]);
    assert.equal(restored.responses.q.text,'unsaved input');restored.responses.q.text+=' continued in another tab';
    assert.equal(await b.saveAttempt(restored),true);assert.equal(await a.saveAttempt(pending,{checkpointed:true}),false);
    assert.equal((await a.listAttempts())[0].responses.q.text,'unsaved input continued in another tab');
  }));
  await t.test('pending Python grading can finish without allowing answer changes',()=>harness(useIdb,async(a,b)=>{
    const first=makeAttempt('retry');await a.saveAttempt(first);
    Object.assign(first,{phase:'finished',finishedAt:100,result:{mark:null,pending:1}});await a.saveAttempt(first);
    const retry=clone((await b.listAttempts())[0]);retry.phase='grading';assert.equal(await b.saveAttempt(retry),true);
    retry.phase='finished';retry.result={mark:5,pending:0};assert.equal(await b.saveAttempt(retry),true);
    assert.equal(await a.saveAttempt(first),false);
    const altered=clone((await a.listAttempts())[0]);altered.phase='grading';altered.responses.q.text='changed after submission';assert.equal(await a.saveAttempt(altered),false);
    assert.equal((await a.listAttempts())[0].result.mark,5);
  }));
  await t.test('deleting an attempt also removes every tab recovery and fallback record',()=>harness(useIdb,async(a,b)=>{
    const first=makeAttempt('delete');await a.saveAttempt(first);const second=clone((await b.listAttempts())[0]);second.responses.q.text='second';b.checkpoint(second);
    await a.deleteAttempt(first.id);assert.deepEqual(await a.listAttempts(),[]);
  }));
});

test('IndexedDB compares versions atomically even when the local mirror is unavailable',()=>harness(true,async(a,b,rows)=>{
  const live=makeAttempt('idb-only');await a.saveAttempt(live);const stale=clone((await b.listAttempts())[0]);
  live.responses.q.text='new IDB answer';await a.saveAttempt(live);localStorage.clear();
  stale.responses.q.text='stale IDB answer';assert.equal(await b.saveAttempt(stale),false);
  assert.equal(rows.get(live.id).responses.q.text,'new IDB answer');
  assert.equal((await b.listAttempts())[0].responses.q.text,'new IDB answer');
}));

for(const useIdb of [false,true])test(`input checkpoints read only their attempt with ${useIdb?'IndexedDB':'localStorage fallback'}`,t=>harness(useIdb,async(a,b)=>{
  const live=makeAttempt('focused/input:id');await a.saveAttempt(live);
  const legacy={};
  for(let i=0;i<80;i++){
    const archived={...makeAttempt(`archived-${i}`),notes:'x'.repeat(4096),storageVersion:{writer:'old-tab',revision:1,token:`archived-${i}`,baseToken:'legacy'}};
    legacy[archived.id]=archived;
    for(const kind of ['saved','recovery'])localStorage.setItem(`code1430:${kind}:${archived.id}:old-tab`,JSON.stringify(archived));
  }
  legacy[live.id]=clone(live);const legacyRaw=JSON.stringify(legacy);localStorage.setItem('code1430:attempts',legacyRaw);
  const prototype=Object.getPrototypeOf(localStorage),getItem=prototype.getItem,parse=JSON.parse;
  let unrelatedReads=0,readCharacters=0,legacyParses=0;
  prototype.getItem=function(key){const value=getItem.call(this,key);if(key.includes(':archived-'))unrelatedReads++;readCharacters+=value?.length||0;return value;};
  JSON.parse=function(value,...args){if(value===legacyRaw)legacyParses++;return parse.call(this,value,...args);};
  try{
    for(let i=0;i<12;i++){live.responses.q.text=`input ${i}`;assert.equal(a.checkpoint(live),true);}
  }finally{prototype.getItem=getItem;JSON.parse=parse;}
  t.diagnostic(`12 inputs, 80 archived attempts: ${unrelatedReads} unrelated record reads, ${legacyParses} legacy history parses, ${readCharacters} characters read`);
  assert.equal(unrelatedReads,0,'input must not read unrelated per-writer history payloads');
  assert.equal(legacyParses,1,'unchanged legacy history must be parsed once, not per input');
  prototype.getItem=function(key){if(key.includes(':archived-'))unrelatedReads++;return getItem.call(this,key);};
  try{await b.syncAttempt(live);}finally{prototype.getItem=getItem;}
  assert.equal(unrelatedReads,0,'storage-event synchronization must also read only the current attempt');
  assert.equal((await b.listAttempts()).find(attempt=>attempt.id===live.id).responses.q.text,'input 11','the latest input remains synchronously recoverable in another tab');
}));

test('targeted lookup sees legacy changes and new writers without waiting for a storage event',()=>harness(false,async(a,b)=>{
  const live=makeAttempt('legacy-invalidation');await a.saveAttempt(live);
  // Replace one unrelated key with the new writer record, leaving length alone:
  // caches based solely on localStorage.length would miss this change.
  const placeholder='code1430:saved:unrelated:placeholder';localStorage.setItem(placeholder,'{}');
  assert.equal(a.checkpoint(live),true);
  const stale=clone(live),submitted=clone((await b.listAttempts())[0]);Object.assign(submitted,{phase:'finished',finishedAt:10,result:{mark:5,pending:0}});
  const count=localStorage.length;assert.equal(await b.saveAttempt(submitted),true);localStorage.removeItem(placeholder);
  assert.equal(localStorage.length,count);
  assert.equal(a.checkpoint(stale),false,'a new saved writer must be visible synchronously even at unchanged storage length');
  await a.deleteAttempt(live.id);
  const old=makeAttempt('legacy-only');localStorage.setItem('code1430:attempts',JSON.stringify({[old.id]:old}));
  const draft=clone(old);assert.equal(b.checkpoint(draft),true);
  const final={...old,phase:'finished',finishedAt:20,updatedAt:100,result:{mark:4,pending:0}};
  localStorage.setItem('code1430:attempts',JSON.stringify({[old.id]:final}));
  assert.equal(b.checkpoint(draft),false,'a changed legacy JSON value must invalidate the parsed history');
}));
