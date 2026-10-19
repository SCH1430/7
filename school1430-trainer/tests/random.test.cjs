const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/bank.js');
const rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const fixture=(level,selection)=>{const l=C.getLevel({level,...selection});return {schema:1,id:'random-fixture',name:'Ученик',schoolClass:'7 А',level,...selection,startedAt:1000,finishedAt:5000,events:[],answers:l.tasks.map(t=>t.fields.map(f=>structuredClone(f.correct)))};};
test('400 standard draws have exact sizes, six balanced topics and no repeated IDs or families',()=>{
  for(const level of ['base','advanced'])for(let seed=1;seed<=200;seed++){
    const v=C.standardVariant(level,{},rng(seed)),l=C.getLevel({level,...v}),n=level==='base'?15:13;
    assert.equal(v.taskIds.length,n);assert.equal(new Set(v.taskIds).size,n);assert.equal(new Set(l.tasks.map(t=>t.family)).size,n);
    assert.ok(v.taskIds.every(id=>C.bank.find(b=>b.id===id).level===level));assert.equal(Object.keys(l.topicCounts).length,6);
    const counts=Object.values(l.topicCounts);assert.ok(counts.every(n=>n===2||n===3));assert.equal(counts.filter(n=>n===3).length,level==='base'?3:1);
    assert.equal(l.minutes,level==='base'?45:60);
  }
});
test('selection varies across starts and is reproducible only for an explicitly fixed random source',()=>{
  for(const level of ['base','advanced']){
    const draws=Array.from({length:100},(_,i)=>C.standardVariant(level,{},rng(i+1)));
    assert.equal(new Set(draws.map(v=>v.taskIds.join('|'))).size,100);
    assert.ok(new Set(draws.flatMap(v=>v.taskIds)).size>100);
    assert.deepEqual(C.standardVariant(level,{},rng(1430)),C.standardVariant(level,{},rng(1430)));
  }
});
test('needs-fix tasks are excluded and impossible theme capacities fail without weakening balance',()=>{
  const blocked=C.bank.filter(b=>b.task.family==='base-7'||b.task.family==='pack-kilobytes');
  const reviews=Object.fromEntries(blocked.map(b=>[b.id,{status:'needs-fix'}]));
  for(let seed=1;seed<=30;seed++){const v=C.standardVariant('base',{reviews},rng(seed));assert.ok(v.taskIds.every(id=>!reviews[id]));}
  const impossible=Object.fromEntries(C.bank.filter(b=>b.level==='base'&&b.task.topic==='Алгоритмы').map(b=>[b.id,{status:'needs-fix'}]));
  assert.throws(()=>C.standardVariant('base',{reviews:impossible}),/Алгоритмы/);assert.throws(()=>C.standardVariant('custom'));assert.throws(()=>C.standardVariant('base',{},()=>1));
});
test('random composition, order, score and teacher key revisions survive JSON validation; legacy results keep source tasks',()=>{
  for(const level of ['base','advanced']){
    const a=fixture(level,C.standardVariant(level,{},rng(17))),n=a.taskIds.length,id=a.taskIds[0],t=C.getLevel(a).tasks[0];
    const edit={fullText:'Условие, проверенное перед началом.',correct:t.fields.map(f=>structuredClone(f.correct)),steps:['Проверенный разбор.'],reviewer:'Учитель',revision:1};
    const field=t.fields[0];
    edit.correct[0]=Array.isArray(field.correct)?[field.options.find(o=>!field.correct.includes(o))||field.correct[0]]:field.options?field.options.find(o=>o!==field.correct):field.numeric?String(Number(field.correct)+1):field.correct+'X';
    assert.equal(C.fieldCorrect(field,edit.correct[0]),false);a.answers[0]=structuredClone(edit.correct);
    a.taskEdits={[id]:edit};a.notes=['Мой ход решения'];
    const restored=C.validateAttempt(JSON.parse(JSON.stringify(a)));assert.equal(restored.selectionMode,'random-v1');assert.deepEqual(restored.taskIds,a.taskIds);assert.deepEqual(C.getLevel(restored).tasks.map(t=>t.bankId),a.taskIds);assert.equal(restored.notes[0],a.notes[0]);assert.equal(C.score(restored).points,n);assert.equal(C.score(restored).grade,5);assert.equal(C.getLevel(restored).tasks[0].revision,1);assert.equal(restored.deadline,a.startedAt+(level==='base'?45:60)*60000);
    const legacy=fixture(level,{}),clean=C.validateAttempt(legacy);assert.equal(clean.selectionMode,undefined);assert.equal(clean.taskIds,undefined);assert.equal(C.score(clean).points,n);assert.deepEqual(C.getLevel(clean).tasks,C.levels[level].tasks);
  }
});
test('import rejects wrong size, level, repeated family, unbalanced composition and unknown selection modes',()=>{
  const a=fixture('base',C.standardVariant('base',{},rng(2)));
  assert.throws(()=>C.validateAttempt({...a,taskIds:a.taskIds.slice(1)}));assert.throws(()=>C.validateAttempt({...a,taskIds:[a.taskIds[0],...a.taskIds.slice(0,-1)]}));assert.throws(()=>C.validateAttempt({...a,taskIds:['advanced-1',...a.taskIds.slice(1)]}));assert.throws(()=>C.validateAttempt({...a,selectionMode:'random-v2'}));assert.throws(()=>C.validateAttempt({...a,selectionMode:undefined}));assert.throws(()=>C.validateAttempt({...a,taskIds:undefined}));
  const b=fixture('base',C.standardVariant('base',{},rng(8))),rows=b.taskIds.map(id=>C.bank.find(x=>x.id===id));
  const i=rows.findIndex(row=>C.bank.some(x=>x.id!==row.id&&x.task.family===row.task.family));const duplicate=C.bank.find(x=>x.id!==rows[i].id&&x.task.family===rows[i].task.family);const j=rows.findIndex((_,k)=>k!==i);const ids=[...b.taskIds];ids[j]=duplicate.id;assert.throws(()=>C.validateAttempt({...b,taskIds:ids}),/повтор семейства/);
  const selected=C.getLevel(a),counts=selected.topicCounts,lowCount=Math.min(...Object.values(counts)),highCount=Math.max(...Object.values(counts));
  const lowTopic=Object.keys(counts).find(t=>counts[t]===lowCount),usedFamilies=new Set(selected.tasks.map(t=>t.family));
  const candidate=C.bank.find(b=>b.level==='base'&&counts[b.task.topic]===highCount&&!a.taskIds.includes(b.id)&&!usedFamilies.has(b.task.family));assert.ok(candidate);const bad=[...a.taskIds];bad[a.taskIds.findIndex(id=>C.bank.find(b=>b.id===id).task.topic===lowTopic)]=candidate.id;assert.throws(()=>C.validateAttempt({...a,taskIds:bad}),/баланс/);
});
