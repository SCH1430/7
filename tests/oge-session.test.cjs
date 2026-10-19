const {test}=require('node:test');
const assert=require('node:assert/strict');
const O=require('../oge-core.js');
const hash='a'.repeat(64),who={name:'Практика с повторами',schoolClass:'9 А',choice13:'13.1'};
function session(entries=['oge-authored-1-1','oge-authored-1-2'],extra={}){
  const taskNumbers=entries.map((_,i)=>i+1),timeLimitMinutes=extra.timeLimitMinutes??0;
  return {kind:'1430-oge-result',schema:2,id:'qa-session',variantId:O.id,mode:'practice',entries:[...entries],taskNumbers,taskIds:Object.fromEntries(taskNumbers.map(slot=>[slot,entries[slot-1]])),selectionMode:O.selectionMode,bankCycle:1,...who,startedAt:100,deadline:timeLimitMinutes?100+timeLimitMinutes*60000:null,timeLimitMinutes,finishedAt:1000,answers:entries.map(id=>O.bankById(id).key||''),notes:entries.map((_,i)=>`Черновик позиции ${i+1}`),files:{},marks:{},events:[],...extra};
}
function attach(a,slot){const t=O.taskFor(a,slot),extension=O.extensions(t.n,a.choice13)[0];a.files[slot]={name:`answer-${slot}.${extension}`,size:100,sha256:hash};}
function automatic(a,slot,points=O.taskFor(a,slot).max){const t=O.taskFor(a,slot);(a.autoChecks??={})[slot]={status:'checked',points,max:t.max,taskId:t.bankId,checkedAt:1100,engine:'qa',version:'1',summary:'Проверено',fileHash:hash,checks:[],errors:[],notes:[]};}
test('schema 2 resolves repeated OGE numbers to independent ordered slots without mutating bank tasks',()=>{
  const a=O.validate(session()),tasks=O.tasksFor(a);
  assert.deepEqual(tasks.map(t=>[t.n,t.slot,t.bankId]),[[1,1,a.entries[0]],[1,2,a.entries[1]]]);
  for(const t of tasks){assert.equal(t.body,O.bankById(t.bankId).body);assert.equal(O.bankById(t.bankId).slot,undefined);}
  assert.notEqual(tasks[0].key,tasks[1].key);assert.equal(O.taskFor(a,0),undefined);assert.equal(O.taskFor(a,3),undefined);
  const copy=O.validate(JSON.parse(JSON.stringify(a)));assert.deepEqual(copy,a);assert.deepEqual(copy.notes,['Черновик позиции 1','Черновик позиции 2']);
});
test('automatic checking uses actual OGE type even when the slot exceeds 16',()=>{
  const entries=O.bank.filter(t=>t.n===1).slice(0,16).map(t=>t.bankId).concat(['oge-authored-5-1','oge-authored-6-1','oge-authored-16-1']),a=O.validate(session(entries));
  assert.equal(O.taskFor(a,17).n,5);assert.equal(O.taskFor(a,18).n,6);
  for(let slot=1;slot<=18;slot++){assert.equal(O.correct(slot,a.answers[slot-1],a),true,`slot ${slot}`);assert.equal(O.correct(slot,'неверный ответ',a),false);}
  assert.equal(O.correct(19,'',a),false);assert.equal(O.correct(20,'',a),false);assert.equal(O.correct(1.5,'',a),false);
  assert.equal(O.score(a).points,18);assert.equal(O.score(a).grade,null);
});
test('repeated questions keep separate answers and score rows always expose their slot',()=>{
  const a=session();a.answers[1]='неверный ответ';const score=O.score(O.validate(a));
  assert.equal(score.points,1);assert.equal(score.total,2);assert.equal(score.grade,null);assert.deepEqual(score.rows.map(r=>[r.slot,r.task.n,r.value,r.points]),[[1,1,a.answers[0],1],[2,1,a.answers[1],0]]);
  const legacy={schema:1,mode:'practice',taskNumbers:[2,6],answers:Array(16).fill(''),files:{},marks:{}};assert.deepEqual(O.score(legacy).rows.map(r=>r.slot),[2,6]);
});
test('practice accepts every supported duration and an explicit absent deadline when untimed',()=>{
  for(const timeLimitMinutes of [0,10,20,30,45,60,90,150]){const a=O.validate(session(undefined,{timeLimitMinutes}));assert.equal(a.timeLimitMinutes,timeLimitMinutes);assert.equal(a.deadline,timeLimitMinutes?100+timeLimitMinutes*60000:null);assert.equal(O.validate(JSON.parse(JSON.stringify(a))).timeLimitMinutes,timeLimitMinutes);}
  for(const extra of [{timeLimitMinutes:5},{timeLimitMinutes:'20'},{timeLimitMinutes:null},{timeLimitMinutes:undefined},{timeLimitMinutes:0,deadline:100},{timeLimitMinutes:20,deadline:null},{timeLimitMinutes:20,deadline:100+21*60000}])assert.throws(()=>O.validate(session(undefined,extra)));
  const active=session(undefined,{finishedAt:null,timeLimitMinutes:30});assert.equal(O.validate(active,false).finishedAt,null);assert.throws(()=>O.validate(active));
});
test('schema 2 validates unique bank entries, exact slot mapping and bounded parallel arrays',()=>{
  const changes=[a=>a.entries=[],a=>a.entries[1]=a.entries[0],a=>a.entries[0]='unknown',a=>a.entries[0]=1,a=>a.mode='full',a=>a.taskNumbers=[2,1],a=>a.taskNumbers=[1,1],a=>a.taskNumbers=['1',2],a=>a.taskIds[1]=a.entries[1],a=>delete a.taskIds[1],a=>a.taskIds[3]=a.entries[0],a=>a.taskIds['01']=a.entries[0],a=>delete a.selectionMode,a=>a.selectionMode='random',a=>a.bankCycle=0,a=>a.answers.pop(),a=>a.answers[0]='x'.repeat(501),a=>a.notes.push(''),a=>a.notes[0]='x'.repeat(12001)];
  for(const change of changes){const a=session();change(a);assert.throws(()=>O.validate(a));}
  const hundred=O.bank.slice(0,100).map(t=>t.bankId);assert.equal(O.validate(session(hundred)).entries.length,100);
  assert.throws(()=>O.validate(session(O.bank.slice(0,101).map(t=>t.bankId))));
});
test('files, automatic results and teacher marks resolve real types and maximums through slots',()=>{
  const a=session(['oge-authored-14-1','oge-authored-16-1','oge-authored-13-1','oge-authored-16-2','oge-authored-15-1','oge-authored-1-1']);
  for(let slot=1;slot<=5;slot++)attach(a,slot);for(const slot of [1,2,3,5])automatic(a,slot);
  a.marks[4]={points:1,reviewer:'Учитель',comment:'Одна ошибка',at:1200};
  const checked=O.validate(a),score=O.score(checked);assert.equal(checked.autoChecks[1].max,3);assert.equal(checked.autoChecks[2].max,2);assert.equal(score.points,11);assert.equal(score.total,12);assert.equal(score.pending,0);assert.equal(score.grade,null);assert.equal(score.rows[3].evaluation,'teacher');
  assert.equal(score.rows[1].automatic.taskId,a.entries[1]);assert.equal(score.rows[3].automatic,undefined);
  const partial=structuredClone(checked);partial.autoChecks[1]={...partial.autoChecks[1],status:'partial',points:2,unverified:1};const s=O.score(O.validate(partial));assert.equal(s.points,10);assert.equal(s.possible,11);assert.equal(s.pending,1);
  const text=session(['oge-authored-13-1'],{choice13:'13.2'});attach(text,1);assert.match(O.validate(text).files[1].name,/\.odt$/);text.files[1].name='answer.odp';assert.throws(()=>O.validate(text));
});
test('dynamic file validation rejects outside slots, wrong true formats, bounds, IDs and hashes',()=>{
  const base=session(['oge-authored-14-1','oge-authored-16-1','oge-authored-16-2','oge-authored-1-1']);for(const slot of [1,2,3]){attach(base,slot);automatic(base,slot);}
  const changes=[a=>a.files[1].name='wrong.py',a=>a.files[2].name='wrong.ods',a=>a.files[1].size=0,a=>a.files[1].size=6*1024*1024,a=>a.files[1].sha256='bad',a=>a.files[4]={name:'a.py',size:10},a=>a.files[14]=a.files[1],a=>a.files['01']=a.files[1],a=>a.marks[4]={points:0,reviewer:'Учитель',comment:'',at:1000},a=>a.marks[5]={points:0,reviewer:'Учитель',comment:'',at:1000},a=>a.marks[2]={points:3,reviewer:'Учитель',comment:'',at:1000},a=>a.autoChecks[1].max=2,a=>a.autoChecks[2].points=3,a=>a.autoChecks[2].taskId=a.entries[2],a=>delete a.autoChecks[1].taskId,a=>a.autoChecks[1].fileHash='b'.repeat(64),a=>a.autoChecks[14]=a.autoChecks[1],a=>a.autoChecks['01']=a.autoChecks[1],a=>a.autoChecks[4]=a.autoChecks[1],a=>delete a.files[1]];
  for(const change of changes){const a=structuredClone(base);change(a);assert.throws(()=>O.validate(a));}
  const forged=structuredClone(base);forged.autoChecks[2].taskId=forged.entries[2];const score=O.score(forged);assert.equal(score.rows[1].points,null);assert.equal(score.rows[1].automatic,undefined);
});
test('a practical file and its automatic diagnostics survive at slot 100',()=>{
  const table='oge-authored-14-1',entries=O.bank.filter(t=>t.bankId!==table).slice(0,99).map(t=>t.bankId).concat(table),a=session(entries);
  attach(a,100);automatic(a,100);const restored=O.validate(JSON.parse(JSON.stringify(a))),row=O.score(restored).rows[99];
  assert.equal(O.taskFor(restored,100).n,14);assert.equal(restored.autoChecks[100].max,3);assert.equal(row.slot,100);assert.equal(row.points,3);assert.equal(row.automatic.taskId,table);assert.equal(row.evaluation,'auto');
});
test('all practice attachments together fit the 32 MiB JSON transfer budget',()=>{
  const entries=O.bank.filter(t=>t.n===14).slice(0,7).map(t=>t.bankId),a=session(entries),MiB=1024*1024;
  for(let slot=1;slot<=7;slot++){attach(a,slot);a.files[slot].size=5*MiB;}
  assert.throws(()=>O.validate(a),/32 МБ/,'seven individually valid 5 MiB files exceed the combined limit');
  a.files[7].size=2*MiB;const accepted=O.validate(a);assert.equal(Object.values(accepted.files).reduce((sum,file)=>sum+file.size,0),32*MiB);
  a.files[7].size++;assert.throws(()=>O.validate(a),/32 МБ/,'the aggregate boundary is exact');
  a.files[7].size=2*MiB;a.files[1].size=5*MiB+1;assert.throws(()=>O.validate(a),/файл ответа/,'the separate 5 MiB file limit still applies');
});
test('finished slot sessions consume the same history as legacy rotations without counting import duplicates',()=>{
  const a=O.validate(session(['oge-authored-1-1','oge-authored-1-2','oge-authored-13-1','oge-authored-14-1'])),input={...who,attempts:[a]},p=O.studentProgress(input);
  assert.equal(p.completed,4);assert.equal(p.byNumber[1].completed,2);assert.equal(p.byNumber[13].completed,1);assert.equal(p.byNumber[14].completed,1);
  assert.deepEqual(O.studentProgress({...input,attempts:[a,{...a,id:'copy'},session(a.entries,{finishedAt:null})]}),p);
  assert.equal(O.studentProgress({...input,choice13:'13.2'}).byNumber[13].completed,0);assert.equal(O.studentProgress({...input,choice13:'13.2'}).byNumber[14].completed,1);
  assert.equal(O.studentProgress({...input,name:'Другой ученик'}).completed,0);
  const next=O.nextVariant(input,()=>0);for(const id of Object.values(next.taskIds))assert.ok(!a.entries.includes(id));
  const nextResult={...session(a.entries),schema:1,mode:'full',taskNumbers:Array.from({length:16},(_,i)=>i+1),...next,answers:Array(16).fill(''),notes:Array(16).fill(''),deadline:9000100};delete nextResult.entries;delete nextResult.timeLimitMinutes;
  assert.equal(O.studentProgress({...who,attempts:[a,O.validate(nextResult)]}).completed,20);
});
test('slot sessions participate in one common bank cycle, including the choice-specific task 13 history',()=>{
  const attempts=[];for(let i=0;i<O.bank.length;i+=100)attempts.push(O.validate(session(O.bank.slice(i,i+100).map(t=>t.bankId),{id:`batch-${i}`})));
  const p=O.studentProgress({...who,attempts});assert.equal(p.cycle,2);assert.equal(p.completed,0);assert.equal(p.remaining,O.bank.length);assert.equal(O.nextVariant({...who,attempts},()=>0).bankCycle,2);
  const other=O.studentProgress({...who,choice13:'13.2',attempts});assert.equal(other.cycle,1);assert.deepEqual(other.availableNumbers,[13]);assert.equal(other.byNumber[13].remaining,O.bank.filter(t=>t.n===13).length);
  const second=O.validate(session(['oge-authored-1-1'],{bankCycle:2,id:'second'}));const q=O.studentProgress({...who,attempts:[...attempts,second]});assert.equal(q.cycle,2);assert.equal(q.completed,1);assert.equal(q.byNumber[1].completed,1);
});
