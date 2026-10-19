const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/bank.js');
const student={name:'Иванов Иван',schoolClass:'7 А'},rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
function record(level,selection,n=1,pupil=student){return {schema:1,id:level+'-'+n,...pupil,level,...selection,startedAt:n*1000,finishedAt:n*1000+500,answers:[],events:[]};}
test('every level is completely exhausted without any repeated ID before a new cycle; final attempts are short',()=>{
  for(const level of ['base','advanced'])for(let seed=1;seed<=4;seed++){
    const random=rng(seed),attempts=[],issued=new Set(),total=C.bank.filter(b=>b.level===level).length;
    while(issued.size<total){
      const capacity={};for(const b of C.bank.filter(b=>b.level===level&&!issued.has(b.id)))capacity[b.task.topic]=(capacity[b.task.topic]||0)+1;
      const v=C.nextStudentVariant(level,{student,attempts},random);assert.equal(v.bankCycle,1);assert.equal(v.taskIds.length,Math.min(C.levels[level].tasks.length,total-issued.size));
      let quota=0;while(quota<v.taskIds.length&&Object.values(capacity).reduce((sum,n)=>sum+Math.min(n,quota+1),0)<=v.taskIds.length)quota++;
      const counts=C.getLevel({level,...v}).topicCounts;for(const [topic,n] of Object.entries(capacity)){const got=counts[topic]||0;assert.ok(got>=Math.min(n,quota)&&got<=Math.min(n,quota+1),topic);}
      for(const id of v.taskIds){assert.ok(!issued.has(id),id);issued.add(id);}attempts.push(C.validateAttempt(record(level,v,attempts.length+1)));
    }
    const variantSize=C.levels[level].tasks.length;
    assert.equal(issued.size,total);assert.equal(attempts.at(-1).taskIds.length,total%variantSize||variantSize);assert.equal(attempts.length,Math.ceil(total/variantSize));
    const progress=C.studentProgress(level,student,attempts);assert.equal(progress.exhausted,true);assert.equal(progress.remaining,0);assert.equal(C.nextStudentVariant(level,{student,attempts},random).bankCycle,2);
  }
});
test('identity normalizes case, extra spaces and class spacing; levels and different pupils are independent',()=>{
  const v=C.nextStudentVariant('base',{student},rng(2)),a=record('base',v),alias={name:'  ИВАНОВ   ИВАН ',schoolClass:' 7А '};
  assert.equal(C.studentKey(alias),C.studentKey(student));assert.equal(C.studentProgress('base',alias,[a]).completed,15);assert.equal(C.studentProgress('advanced',alias,[a]).completed,0);assert.equal(C.studentProgress('base',{...student,name:'Петров Иван'},[a]).completed,0);assert.equal(C.studentProgress('base',{...student,schoolClass:'7 Б'},[a]).completed,0);
  assert.ok(C.nextStudentVariant('base',{student:alias,attempts:[a]},rng(3)).taskIds.every(id=>!v.taskIds.includes(id)));
});
test('legacy, custom and imported results count once, active attempts do not; history rebuild survives JSON',()=>{
  const legacy=record('base',{},1),ids=C.levels.base.tasks.map(t=>t.bankId),custom={...record('base',{},2),level:'custom',customTitle:'Практика',minutes:10,taskIds:['base-7','advanced-13']};
  const pending={...record('base',C.nextStudentVariant('base',{student},rng(2)),3),finishedAt:null};
  const records=[C.validateAttempt(legacy),C.validateAttempt(custom),pending];
  assert.equal(C.studentProgress('base',student,records).completed,15);assert.equal(C.studentProgress('advanced',student,records).completed,1);
  assert.equal(C.studentProgress('base',student,[...records,records[0]]).completed,15);
  const next=C.nextStudentVariant('base',{student,attempts:JSON.parse(JSON.stringify(records))},rng(3));assert.ok(next.taskIds.every(id=>!ids.includes(id)));
});
test('exhausted topics are skipped, remaining families can repeat, and only unavailable tasks are excluded',()=>{
  const remaining=C.bank.filter(b=>b.level==='base'&&b.task.family==='pack-kilobytes').slice(0,8).map(b=>b.id),used=C.bank.filter(b=>b.level==='base'&&!remaining.includes(b.id)).map(b=>b.id);
  const history=[];for(let i=0;i<used.length;i+=60)history.push({...record('base',{},i+1),level:'custom',customTitle:'Банк',minutes:120,taskIds:used.slice(i,i+60)});
  const v=C.nextStudentVariant('base',{student,attempts:history},rng(4));assert.deepEqual(new Set(v.taskIds),new Set(remaining));assert.equal(v.bankCycle,1);assert.equal(C.getLevel({level:'base',...v}).tasks.length,8);
  const blocked=Object.fromEntries(C.bank.filter(b=>b.level==='base'&&!remaining.includes(b.id)).map(b=>[b.id,{status:'needs-fix'}]));
  assert.equal(C.nextStudentVariant('base',{student,reviews:blocked},rng(5)).taskIds.length,8);assert.throws(()=>C.nextStudentVariant('base',{student,reviews:Object.fromEntries(C.bank.map(b=>[b.id,{status:'needs-fix'}]))}),/нет доступных/);
});
test('cycle/order/keys survive import, older cycle imports do not erase current progress, malformed rotations are rejected',()=>{
  const v=C.nextStudentVariant('advanced',{student},rng(6)),a=record('advanced',v);a.answers=C.getLevel(a).tasks.map(t=>t.fields.map(f=>structuredClone(f.correct)));const clean=C.validateAttempt(JSON.parse(JSON.stringify(a)));assert.deepEqual(clean.taskIds,v.taskIds);assert.equal(clean.bankCycle,1);assert.equal(C.score(clean).points,13);
  const second=record('advanced',{...v,bankCycle:2},5),old=record('advanced',v,9);const p=C.studentProgress('advanced',student,[second,old]);assert.equal(p.cycle,2);assert.equal(p.completed,13);
  for(const patch of [{bankCycle:0},{bankCycle:1.5},{bankCycle:undefined},{taskIds:[]},{taskIds:[...v.taskIds,v.taskIds[0]]},{taskIds:['base-1']}])assert.throws(()=>C.validateAttempt({...a,...patch}));
});
