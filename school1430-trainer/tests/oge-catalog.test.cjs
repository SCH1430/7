const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const O=require('../dist/oge-core.js');
const C=require('../dist/oge-catalog.js');

const student={name:'Семёнов Тест',schoolClass:'9 А'};
const draft=(taskIds=[],extra={})=>({taskIds,choice13:'13.1',automatic:false,timeLimitMinutes:20,...extra});
function finished(selection,extra={}){
  const length=selection.schema===2?selection.entries.length:16,answers=Array(length).fill('');
  for(const slot of selection.taskNumbers)answers[slot-1]=O.bankById(selection.taskIds[slot]).key||'';
  const deadline=selection.schema===2?(selection.timeLimitMinutes===0?null:100+selection.timeLimitMinutes*60000):9000100;
  return {kind:'1430-oge-result',schema:1,id:'qa-oge-catalog',variantId:O.id,
    startedAt:100,deadline,finishedAt:200,answers,notes:Array(length).fill(''),
    files:{},marks:{},events:[],...selection,...extra};
}
function legacy(ids,extra={}){
  const taskNumbers=ids.map(id=>O.bankById(id).n),taskIds=Object.fromEntries(ids.map(id=>[O.bankById(id).n,id]));
  return finished({mode:'practice',taskNumbers,taskIds,selectionMode:O.selectionMode,bankCycle:1,...student,choice13:'13.1'},extra);
}

test('catalog exposes the full bank and accurate labels in CommonJS and browser builds',()=>{
  const rows=C.rows();
  assert.equal(rows.length,O.bank.length);
  assert.equal(new Set(rows.map(t=>t.id)).size,rows.length);
  assert.deepEqual(C.labels,{start:'Разминка',standard:'По демоверсии',challenge:'Усложнённый'});
  assert.deepEqual(C.timeLimits,[0,10,20,30,45,60,90,150]);
  assert.equal(C.maxTasks,100);
  for(const t of rows){assert.equal(t.id,t.bankId);assert.equal(O.bankById(t.id).n,t.n);assert.equal(t.difficultyLabel,C.labels[t.difficulty]);assert.ok(t.topic);assert.equal(t.status,'new');}
  rows[0].title='Changed copy';rows.pop();assert.equal(C.rows().length,O.bank.length);assert.notEqual(C.rows()[0].title,'Changed copy');
  const context={OGE1430:O};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../dist/oge-catalog.js'),'utf8'),context);
  assert.deepEqual(Array.from(context.OGECatalog1430.rows(),t=>t.id),C.rows().map(t=>t.id));
});

test('filters intersect level, number, topic and origin; search normalizes case and ё/е',()=>{
  const topic=O.bankById('oge-level-challenge-1-1').topic,filters={difficulty:'challenge',number:'1',topic,origin:'authored'};
  assert.deepEqual(C.filter(filters).map(t=>t.id),Array.from({length:4},(_,i)=>`oge-level-challenge-1-${i+1}`));
  assert.equal(C.filter({...filters,origin:'fipi'}).length,0);
  assert.equal(C.filter({...filters,topic:'Несуществующая тема'}).length,0);
  assert.equal(C.filter({difficulty:'all',number:'all',topic:'all',origin:'all',status:'all',search:'   '}).length,O.bank.length);
  assert.equal(C.filter({origin:'fipi'}).length,16);
  const withYo=C.filter({search:'ПОСЁЛОК'}).map(t=>t.id);assert.ok(withYo.length>0);assert.deepEqual(C.filter({search:'поселок'}).map(t=>t.id),withYo);
  assert.deepEqual(C.filter({...filters,search:'восклицательных   знака'}).map(t=>t.id),['oge-level-challenge-1-1','oge-level-challenge-1-3']);
  assert.equal(C.filter({...filters,search:'восклицательных отсутствует'}).length,0);
  assert.deepEqual(C.filter({search:'oge-level-start-10-2'}).map(t=>t.id),['oge-level-start-10-2']);
});

test('drafts allow different versions of one number, reject duplicate IDs and preserve legacy timer defaults',()=>{
  assert.deepEqual(C.validateDraft({taskIds:[],choice13:'13.1'}),draft());
  const input=draft(['oge-fipi-1','oge-level-start-1-1'],{automatic:true,timeLimitMinutes:0}),copy=C.validateDraft(input);
  assert.deepEqual(copy,input);copy.taskIds.pop();assert.equal(input.taskIds.length,2);
  assert.equal(C.validateDraft(draft([],{automatic:'true'})).automatic,false);
  const hundred=O.bank.slice(0,100).map(t=>t.bankId);assert.equal(C.validateDraft(draft(hundred)).taskIds.length,100);
  for(const input of [null,{},[],draft(null),draft('oge-fipi-1'),draft([null]),draft([1]),draft(['missing']),draft(['oge-fipi-1','oge-fipi-1']),draft(O.bank.slice(0,101).map(t=>t.bankId))])assert.throws(()=>C.validateDraft(input));
  for(const choice13 of [undefined,null,'','13','13.3',13.1,true,{},[]])assert.throws(()=>C.validateDraft(draft(['oge-fipi-13'],{choice13})),String(choice13));
  for(const timeLimitMinutes of [null,'20',-1,5,15,151,Infinity,NaN,true])assert.throws(()=>C.validateDraft(draft([],{timeLimitMinutes})),String(timeLimitMinutes));
  for(const timeLimitMinutes of C.timeLimits)assert.equal(C.validateDraft(draft([],{timeLimitMinutes})).timeLimitMinutes,timeLimitMinutes);
});

test('manual selection appends an exact ID, keeps other versions and order, and clears automatic status',()=>{
  const input=draft(['oge-fipi-10','oge-fipi-1','oge-fipi-5'],{automatic:true,timeLimitMinutes:45}),before=structuredClone(input);
  const added=C.toggle(input,'oge-level-challenge-1-4',true);
  assert.deepEqual(added.taskIds,[...input.taskIds,'oge-level-challenge-1-4']);assert.equal(added.automatic,false);assert.equal(added.timeLimitMinutes,45);assert.deepEqual(input,before);
  assert.deepEqual(C.toggle(added,'oge-level-challenge-1-4',true),added);
  assert.deepEqual(C.toggle(added,'oge-fipi-1',false).taskIds,['oge-fipi-10','oge-fipi-5','oge-level-challenge-1-4']);
  assert.throws(()=>C.toggle(input,'unknown',true));assert.throws(()=>C.toggle(input,'unknown',false));
  const hundred=draft(O.bank.slice(0,100).map(t=>t.bankId));assert.throws(()=>C.toggle(hundred,O.bank[100].bankId,true),/100/);assert.equal(C.toggle(hundred,hundred.taskIds[0],true).taskIds.length,100);
});

test('schema 2 exact IDs and repeated exam numbers survive JSON, validation and scoring in their own slots',()=>{
  const ids=['oge-level-challenge-5-1','oge-level-start-1-2','oge-level-start-5-2','oge-level-challenge-6-2','oge-fipi-1'];
  const selection=C.selection(draft(ids,{timeLimitMinutes:30}),{name:'  Семёнов Тест  ',schoolClass:' 9 А '});
  assert.equal(selection.schema,2);assert.equal(selection.mode,'practice');assert.equal(selection.selectionMode,'oge-rotation-v1');assert.equal(selection.bankCycle,1);assert.equal(selection.timeLimitMinutes,30);
  assert.equal(selection.name,student.name);assert.equal(selection.schoolClass,student.schoolClass);assert.deepEqual(selection.entries,ids);assert.deepEqual(selection.taskNumbers,[1,2,3,4,5]);
  assert.deepEqual(selection.taskNumbers.map(slot=>selection.taskIds[slot]),ids);
  const attempt=O.validate(JSON.parse(JSON.stringify(finished(selection))));assert.deepEqual(attempt.taskIds,selection.taskIds);assert.deepEqual(attempt.entries,ids);
  const score=O.score(attempt);assert.deepEqual(score.rows.map(r=>r.task.bankId),ids);assert.deepEqual(score.rows.map(r=>r.slot),[1,2,3,4,5]);assert.deepEqual(score.rows.map(r=>r.task.n),[5,1,5,6,1]);assert.equal(score.points,5);assert.equal(score.total,5);assert.equal(score.grade,null);
});

test('all timer choices including no timer form valid practice results, and 100 slots remain distinct',()=>{
  for(const timeLimitMinutes of C.timeLimits){const a=O.validate(finished(C.selection(draft(['oge-fipi-1'],{timeLimitMinutes}),student)));assert.equal(a.timeLimitMinutes,timeLimitMinutes);assert.equal(a.deadline,timeLimitMinutes?100+timeLimitMinutes*60000:null);}
  const ids=O.bank.slice(0,100).map(t=>t.bankId),a=O.validate(finished(C.selection(draft(ids),student)));
  assert.equal(a.answers.length,100);assert.equal(a.notes.length,100);assert.equal(O.score(a).rows.length,100);assert.deepEqual(a.taskNumbers,Array.from({length:100},(_,i)=>i+1));
});

test('selection validates identity and preserves the practical format independently of slot numbers',()=>{
  assert.throws(()=>C.selection(draft(),student));
  for(const bad of [{name:' ',schoolClass:'9А'},{name:'А',schoolClass:'9А'},{name:'А'.repeat(101),schoolClass:'9А'},{name:'Ученик Тест',schoolClass:' '},{name:'Ученик Тест',schoolClass:'9'.repeat(21)}])assert.throws(()=>C.selection(draft(['oge-fipi-1']),bad));
  const selection=C.selection(draft(['oge-fipi-13','oge-authored-13-3','oge-fipi-3'],{choice13:'13.2'}),student);assert.equal(selection.choice13,'13.2');assert.deepEqual(O.validate(finished(selection)).entries,selection.entries);
});

test('automatic selection allows many versions per number and balances numbers when capacities allow',()=>{
  const before=JSON.stringify(O.bank),many=C.auto({count:100,difficulty:'standard',timeLimitMinutes:0},()=>.31);
  assert.equal(many.taskIds.length,100);assert.equal(new Set(many.taskIds).size,100);assert.equal(many.automatic,true);assert.equal(many.timeLimitMinutes,0);
  const counts=Array.from({length:16},(_,i)=>many.taskIds.filter(id=>O.bankById(id).n===i+1).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
  const oneNumber=C.auto({count:4,number:5,difficulty:'start',origin:'authored',choice13:'13.2'},()=>0);
  assert.equal(oneNumber.choice13,'13.2');assert.deepEqual(oneNumber.taskIds,Array.from({length:4},(_,i)=>`oge-level-start-5-${i+1}`));
  const full=C.auto({difficulty:'standard',origin:'fipi',count:16},()=>.999999999);assert.deepEqual(full.taskIds,Array.from({length:16},(_,i)=>`oge-fipi-${i+1}`));assert.equal(JSON.stringify(O.bank),before);
});

test('availability reports conditions and distinct numbers before automatic selection',()=>{
  const info=C.availability({difficulty:'start',number:1});assert.equal(info.total,4);assert.equal(info.numberCount,1);assert.equal(info.availableCount,4);assert.equal(info.maxCount,4);assert.equal(info.personal,false);
  assert.equal(C.availability({}).maxCount,100);
  const first=O.validate(legacy(['oge-level-start-1-1'])),personal=C.availability({number:1,difficulty:'start',student,attempts:[first]});assert.equal(personal.total,4);assert.equal(personal.availableCount,3);assert.equal(personal.maxCount,3);assert.equal(personal.personal,true);assert.ok(!personal.availableIds.includes('oge-level-start-1-1'));
});

test('automatic selection rejects invalid or impossible counts, bad formats, timers and RNG values',()=>{
  for(const count of [undefined,null,'',0,-1,101,1.2,NaN,Infinity,'many'])assert.throws(()=>C.auto({count}),String(count));
  for(const input of [{count:5,number:4,difficulty:'start'},{count:18,number:4,difficulty:'standard'},{count:1,search:'this task does not exist'}])assert.throws(()=>C.auto(input),/доступно/);
  for(const value of [-.01,1,Infinity,-Infinity,NaN,undefined,'invalid'])assert.throws(()=>C.auto({count:1,number:1},()=>value),/генератора/,String(value));
  for(const choice13 of [null,'',false,0,'13.3'])assert.throws(()=>C.auto({count:1,choice13},()=>0));
  assert.throws(()=>C.auto({count:1,timeLimitMinutes:15},()=>0));
});

test('history statuses reflect latest actual score per exact ID and keep practical pending distinct',()=>{
  const ids=['oge-level-start-1-1','oge-level-start-1-2','oge-authored-13-1'],selection=C.selection(draft(ids),student);
  const a=O.validate(finished(selection,{answers:['неверно',O.bankById(ids[1]).key,''],files:{3:{name:'answer.odp',size:100}}}));
  const before=JSON.stringify(a),input={student:{name:'  СЕМЕНОВ   ТЕСТ ',schoolClass:'9а'},attempts:[a],choice13:'13.1'};
  assert.deepEqual(ids.map(id=>C.history(input)[id].status),['wrong','solved','pending']);assert.deepEqual(C.filter({...input,status:'wrong'}).map(t=>t.id),[ids[0]]);assert.equal(C.filter({...input,status:'pending'})[0].id,ids[2]);assert.equal(C.rows(input).find(t=>t.id===ids[2]).statusLabel,'Ожидает проверки');
  const later=O.validate(finished(C.selection(draft([ids[0]]),student),{finishedAt:300,id:'fixed'}));assert.equal(C.history({...input,attempts:[later,a]})[ids[0]].status,'solved');
  assert.equal(C.rows({...input,choice13:'13.2'}).find(t=>t.id===ids[2]).status,'new');assert.equal(C.rows({...input,student:{...student,schoolClass:'9Б'}}).find(t=>t.id===ids[0]).status,'new');
  assert.equal(JSON.stringify(a),before);
});

test('legacy fixed-demo results contribute statuses and broken or active attempts do not',()=>{
  const valid=O.validate(legacy(['oge-fipi-1'])),fixed={...valid};delete fixed.selectionMode;delete fixed.taskIds;delete fixed.bankCycle;
  assert.equal(C.history({student,attempts:[fixed]})['oge-fipi-1'].status,'solved');
  const active={...valid,finishedAt:null},broken={...valid,answers:null},other={...valid,name:'Другой ученик'};
  assert.deepEqual(C.history({student,attempts:[active,broken,other]}),{});assert.deepEqual(C.history({attempts:[valid]}),{});
});

test('newer imported results win timestamp ties because stored history lists newest records first',()=>{
  const id='oge-authored-13-1',selection=C.selection(draft([id]),student);
  const base=finished(selection,{files:{1:{name:'answer.odp',size:100}}});
  const mark=points=>({points,reviewer:'Учитель',comment:'Уточнение после проверки',at:400});
  const older=O.validate({...base,id:'old-result',marks:{1:mark(0)}});
  const imported=O.validate({...base,id:'new-import',marks:{1:mark(2)}});
  assert.equal(imported.finishedAt,older.finishedAt);
  const input={student,attempts:[imported,older],choice13:'13.1'};
  assert.equal(C.history(input)[id].status,'solved');
  assert.equal(C.history(input)[id].points,2);
  assert.deepEqual(C.filter({...input,status:'solved'}).map(t=>t.id),[id]);
  assert.equal(C.filter({...input,status:'wrong'}).length,0);
});

test('automatic picks share normalized history across schemas and filters without mutating bank or attempts',()=>{
  const first=C.auto({count:2,number:1,difficulty:'start',student},()=>0),a=O.validate(finished(C.selection(first,student))),old=O.validate(legacy(['oge-level-start-1-3'])),attempts=[a,old],before=JSON.stringify(attempts),bankBefore=JSON.stringify(O.bank);
  const alias={name:'  СЕМЕНОВ   ТЕСТ ',schoolClass:'9а'},next=C.auto({count:1,number:1,difficulty:'start',student:alias,attempts},()=>0);
  assert.deepEqual(next.taskIds,['oge-level-start-1-4']);assert.equal(O.studentProgress({...student,choice13:'13.1',attempts}).byNumber[1].used,3);
  assert.equal(JSON.stringify(attempts),before);assert.equal(JSON.stringify(O.bank),bankBefore);
  assert.deepEqual(C.auto({count:2,number:1,difficulty:'start',student:{...student,schoolClass:'9Б'},attempts},()=>0).taskIds,first.taskIds);
});

test('stale automatic drafts are rejected but manual repeats remain possible, including within one number',()=>{
  const automatic=C.auto({count:2,number:3,difficulty:'start',student},()=>0),attempts=[O.validate(finished(C.selection(automatic,student)))];
  assert.throws(()=>C.selection(automatic,student,attempts),/уже встречалась/);
  const manual=C.toggle(automatic,automatic.taskIds[0],true);assert.equal(manual.automatic,false);assert.deepEqual(C.selection(manual,student,attempts).entries,automatic.taskIds);
  const active=finished(C.selection(automatic,student),{finishedAt:null});assert.deepEqual(C.selection(automatic,student,[active]).entries,automatic.taskIds);
});

test('13.1 and 13.2 keep separate history across choosing, filtering and starting automatic drafts',()=>{
  const automatic=C.auto({count:2,number:13,choice13:'13.1',student},()=>0),attempts=[O.validate(finished(C.selection(automatic,student)))];
  assert.throws(()=>C.selection(automatic,student,attempts),/уже встречалась/);
  assert.deepEqual(C.selection({...automatic,choice13:'13.2'},student,attempts).entries,automatic.taskIds);
  assert.deepEqual(C.auto({count:2,number:13,choice13:'13.2',student,attempts},()=>0).taskIds,automatic.taskIds);
  assert.ok(C.auto({count:2,number:13,choice13:'13.1',student,attempts},()=>0).taskIds.every(id=>!automatic.taskIds.includes(id)));
});

test('exhausting one filtered level never resets the common bank cycle',()=>{
  const chosen=C.auto({count:4,number:5,difficulty:'start',student},()=>0),attempts=[O.validate(finished(C.selection(chosen,student)))];
  assert.throws(()=>C.auto({count:1,number:5,difficulty:'start',student,attempts},()=>0),/доступно 0/);
  const standard=C.auto({count:1,number:5,difficulty:'standard',student,attempts},()=>0);assert.equal(C.selection(standard,student,attempts).bankCycle,1);
  const p=O.studentProgress({...student,choice13:'13.1',attempts});assert.equal(p.byNumber[5].completed,4);assert.equal(p.byNumber[5].remaining,O.bank.filter(t=>t.n===5).length-4);
});

test('retry exact includes only mistakes and pending files, preserving order, format and timer',()=>{
  const ids=['oge-level-challenge-5-1','oge-level-start-1-1','oge-authored-13-1'],selection=C.selection(draft(ids,{timeLimitMinutes:45,choice13:'13.2'}),student);
  const a=O.validate(finished(selection,{answers:[O.bankById(ids[0]).key,'wrong',''],files:{3:{name:'answer.odt',size:100}}})),before=JSON.stringify(a);
  const exact=C.retry(a,'exact',[a]);assert.deepEqual(exact,draft([ids[1],ids[2]],{timeLimitMinutes:45,choice13:'13.2'}));assert.equal(JSON.stringify(a),before);
  assert.deepEqual(O.validate(finished(C.selection(exact,student,[a]))).entries,exact.taskIds);
});

test('retry analogue preserves real exam number and level, uses unique new IDs and guards staleness',()=>{
  const ids=['oge-level-start-1-1','oge-level-start-1-2','oge-level-challenge-5-1'],selection=C.selection(draft(ids,{timeLimitMinutes:0}),student);
  const a=O.validate(finished(selection,{answers:['wrong','wrong','wrong']})),before=JSON.stringify(a),next=C.retry(a,'analogue',[],()=>0);
  assert.equal(next.automatic,true);assert.equal(next.timeLimitMinutes,0);assert.equal(new Set(next.taskIds).size,3);
  assert.deepEqual(next.taskIds.map(id=>[O.bankById(id).n,O.bankById(id).difficulty]),ids.map(id=>[O.bankById(id).n,O.bankById(id).difficulty]));assert.ok(next.taskIds.every(id=>!ids.includes(id)));
  const repeat=O.validate(finished(C.selection(next,student,[a])));assert.throws(()=>C.selection(next,student,[a,repeat]),/уже встречалась/);assert.equal(JSON.stringify(a),before);
});

test('retry falls back to all rows after success and legacy standard level with the default short timer',()=>{
  const a=O.validate(legacy(['oge-fipi-1','oge-fipi-5'])),exact=C.retry(a,'exact');assert.deepEqual(exact.taskIds,['oge-fipi-1','oge-fipi-5']);assert.equal(exact.timeLimitMinutes,20);
  const next=C.retry(a,'analogue',[],()=>0);assert.equal(next.taskIds.length,2);assert.ok(next.taskIds.every(id=>O.bankById(id).difficulty==='standard'));assert.ok(!next.taskIds.includes('oge-fipi-1'));assert.ok(!next.taskIds.includes('oge-fipi-5'));
});

test('retry cannot silently lower difficulty, recycle unavailable IDs or accept invalid random values',()=>{
  const ids=Array.from({length:4},(_,i)=>`oge-level-start-1-${i+1}`),a=O.validate(finished(C.selection(draft(ids),student),{answers:Array(4).fill('wrong')})),before=JSON.stringify(a);
  assert.throws(()=>C.retry(a,'analogue',[a],()=>0),/№1.*Разминка.*не осталось/);assert.equal(JSON.stringify(a),before);
  const partial=O.validate(finished(C.selection(draft(ids.slice(0,3)),student),{answers:Array(3).fill('wrong')}));assert.throws(()=>C.retry(partial,'analogue',[],()=>0),/не осталось/);
  const one=O.validate(legacy(['oge-fipi-1'],{answers:Array(16).fill('wrong')}));for(const v of [-.1,1,Infinity,NaN])assert.throws(()=>C.retry(one,'analogue',[],()=>v),/генератора/);
  assert.throws(()=>C.retry(one,'unknown'));assert.throws(()=>C.retry({...one,taskIds:{1:'unknown'}},'exact'));
});
