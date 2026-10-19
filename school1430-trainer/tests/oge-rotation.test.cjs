const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('../dist/oge-core.js');
const nums=Array.from({length:16},(_,i)=>i+1),who={name:'Семёнов   Тест',schoolClass:'9 А',choice13:'13.1'};
function result(selection,extra={}){return {kind:'1430-oge-result',schema:1,id:'qa-'+Math.random(),variantId:O.id,mode:'full',taskNumbers:nums,name:who.name,schoolClass:who.schoolClass,choice13:who.choice13,startedAt:100,deadline:9000100,finishedAt:200,answers:Array(16).fill(''),notes:Array(16).fill(''),files:{},marks:{},events:[],...selection,...extra};}
test('unequal position capacities exhaust the entire bank without repeats before one common new cycle',()=>{
  const attempts=[],seen=new Map(nums.map(n=>[n,new Set()])),capacities=nums.map(n=>O.bank.filter(t=>t.n===n).length);
  let progress=O.studentProgress({...who,attempts});
  while(progress.cycle===1){
    assert.ok(attempts.length<O.bank.length,'the bank must make progress');
    const taskNumbers=progress.availableNumbers,v=O.nextVariant({...who,attempts,taskNumbers},()=>.31);
    assert.equal(v.bankCycle,1);assert.equal(Object.keys(v.taskIds).length,taskNumbers.length);
    for(const n of taskNumbers){assert.ok(!seen.get(n).has(v.taskIds[n]),`repeat for №${n}`);seen.get(n).add(v.taskIds[n]);}
    attempts.push(O.validate(result(v,{taskNumbers,mode:taskNumbers.length===nums.length?'full':'practice'})));
    progress=O.studentProgress({...who,attempts});
  }
  assert.equal(attempts.length,Math.max(...capacities));assert.equal(attempts.filter(a=>a.mode==='full').length,Math.min(...capacities));
  for(const n of nums)assert.deepEqual([...seen.get(n)].sort(),O.bank.filter(t=>t.n===n).map(t=>t.bankId).sort());
  assert.equal([...seen.values()].reduce((sum,set)=>sum+set.size,0),O.bank.length);
  const next=O.nextVariant({...who,attempts},()=>0);assert.equal(progress.cycle,2);assert.equal(progress.remaining,O.bank.length);assert.equal(progress.completed,0);assert.equal(next.bankCycle,2);attempts.push(result(next));assert.equal(O.studentProgress({...who,attempts}).remaining,O.bank.length-nums.length);
});
test('identity normalization and duplicate imports preserve history; active attempts do not consume it',()=>{
  const first=O.nextVariant(who,()=>0),attempt=result(first),attempts=[attempt],input={name:'  СЕМЕНОВ ТЕСТ ',schoolClass:'9а',choice13:'13.1',attempts};const before=O.studentProgress(input);assert.equal(before.completed,16);assert.deepEqual(O.studentProgress({...input,attempts:[attempt,{...attempt,id:'imported-copy'},result(first,{finishedAt:null})]}),before);assert.equal(O.studentProgress({...input,name:'Другой ученик'}).completed,0);assert.equal(O.studentProgress({...input,schoolClass:'9б'}).completed,0);const next=O.nextVariant(input,()=>0);for(const n of nums)assert.notEqual(next.taskIds[n],first.taskIds[n]);
});
test('a practiced position cannot silently repeat while other positions remain unfinished',()=>{
  const attempts=[],capacity=O.bank.filter(t=>t.n===5).length;for(let k=0;k<capacity;k++){const v=O.nextVariant({...who,attempts,taskNumbers:[5]},()=>0);attempts.push(result(v,{mode:'practice',taskNumbers:[5]}));}const p=O.studentProgress({...who,attempts});assert.equal(p.byNumber[5].remaining,0);assert.equal(p.remaining,O.bank.length-capacity);assert.equal(p.exhausted,false);assert.deepEqual(p.exhaustedNumbers,[5]);assert.throws(()=>O.nextVariant({...who,attempts,taskNumbers:[5]}),e=>e.code==='OGE_BANK_POSITION_EXHAUSTED'&&!e.availableNumbers.includes(5));assert.throws(()=>O.nextVariant({...who,attempts}),/отдельная практика/);assert.equal(O.nextVariant({...who,attempts,taskNumbers:[1,2]},()=>0).bankCycle,1);
  let progress=p;while(progress.cycle===1){const taskNumbers=progress.availableNumbers,v=O.nextVariant({...who,attempts,taskNumbers},()=>0);attempts.push(result(v,{mode:'practice',taskNumbers}));progress=O.studentProgress({...who,attempts});}assert.equal(O.nextVariant({...who,attempts},()=>0).bankCycle,2);
});
test('difficulty changes share one history and exhausting a level leaves the other levels available',()=>{
  const attempts=[],seen=new Set(),taskNumbers=[5],input=()=>({...who,attempts,taskNumbers});
  const take=difficulty=>{const v=O.nextVariant({...input(),difficulty},()=>0),id=v.taskIds[5];assert.equal(v.bankCycle,1);assert.ok(!seen.has(id),'changing filters must not repeat a finished task');if(difficulty!=='all')assert.equal(O.bankById(id).difficulty,difficulty);seen.add(id);attempts.push(O.validate(result(v,{mode:'practice',taskNumbers})));return id;};
  for(let i=0;i<4;i++)take('start');
  const progress=O.studentProgress(input());assert.equal(progress.byNumber[5].completed,4);assert.equal(progress.byNumber[5].remaining,O.bank.filter(t=>t.n===5).length-4);assert.equal(progress.cycle,1);
  assert.throws(()=>O.nextVariant({...input(),difficulty:'start'}),e=>e.code==='OGE_BANK_FILTER_EXHAUSTED');
  take('standard');take('all');take('challenge');
  assert.equal(O.studentProgress(input()).byNumber[5].completed,7);assert.equal(O.studentProgress(input()).cycle,1);
  assert.throws(()=>O.nextVariant({...input(),difficulty:'start'}),e=>e.code==='OGE_BANK_FILTER_EXHAUSTED');
  const none=O.nextVariant({...who,taskNumbers:[11]},()=>0),all=O.nextVariant({...who,taskNumbers:[11],difficulty:'all'},()=>0);assert.deepEqual(none,all);
  const practical=O.nextVariant({...who,taskNumbers:[11,12,13,14,15,16],difficulty:'challenge'},()=>0);for(const id of Object.values(practical.taskIds))assert.equal(O.bankById(id).difficulty,'challenge');
});
test('13.1 and 13.2 have separate histories and share all other position histories',()=>{
  const first=O.nextVariant(who,()=>0),attempts=[result(first)],other=O.studentProgress({...who,choice13:'13.2',attempts});assert.equal(other.byNumber[13].completed,0);assert.equal(other.byNumber[14].completed,1);const v=O.nextVariant({...who,choice13:'13.2',attempts},()=>0);assert.equal(v.taskIds[13],first.taskIds[13]);assert.notEqual(v.taskIds[12],first.taskIds[12]);
});
test('finished fixed-demo results consume their original FIPI task IDs exactly once',()=>{
  const a=result(undefined),p=O.studentProgress({...who,attempts:[a,{...a,id:'copy'}]});assert.equal(p.completed,16);const v=O.nextVariant({...who,attempts:[a]},()=>0);for(const n of nums)assert.equal(v.taskIds[n],`oge-authored-${n}-1`);
});
test('selection validation rejects unknown/missing/wrong-position IDs and mismatched automatic checks',()=>{
  const v=O.nextVariant(who,()=>0),a=result(v);assert.deepEqual(O.validate(a).taskIds,v.taskIds);assert.equal(O.validate(a).bankCycle,1);for(const change of [x=>delete x.taskIds[5],x=>x.taskIds[1]='oge-authored-2-1',x=>x.taskIds[1]='fake',x=>x.taskIds[17]='oge-fipi-1',x=>x.bankCycle=0,x=>x.bankCycle=1.5,x=>x.selectionMode='random',x=>delete x.selectionMode]){const bad=structuredClone(a);change(bad);assert.throws(()=>O.validate(bad));}
  const g={status:'checked',points:2,max:2,taskId:v.taskIds[16],checkedAt:1000,engine:'qa',version:'1',summary:'Проверено',fileHash:'a'.repeat(64),checks:[],errors:[],notes:[]};a.files[16]={name:'answer.py',size:100,sha256:g.fileHash};a.autoChecks={16:g};assert.equal(O.validate(a).autoChecks[16].taskId,v.taskIds[16]);for(const id of [undefined,'oge-authored-16-1','oge-authored-14-1']){const bad=structuredClone(a);bad.autoChecks[16].taskId=id;assert.throws(()=>O.validate(bad));}a.autoChecks[16].taskId='oge-authored-16-1';assert.equal(O.score(a).rows[15].points,null);
});
test('generator rejects malformed input and RNG values instead of producing corrupted IDs',()=>{
  for(const taskNumbers of [[],[1,1],[0],[17],['1']])assert.throws(()=>O.nextVariant({...who,taskNumbers}));for(const value of [-.1,1,Infinity,NaN])assert.throws(()=>O.nextVariant(who,()=>value));for(const difficulty of ['',null,'advanced','START',0,[],{}])assert.throws(()=>O.nextVariant({...who,difficulty}));assert.throws(()=>O.nextVariant({...who,name:' '}));
});
