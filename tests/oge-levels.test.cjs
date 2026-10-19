const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('../oge-levels.js'),O=require('../oge-core.js'),tasks=L.create(O.tasks);
const unescape=s=>s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const rows=t=>[...t.body.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c=>unescape(c[1])));
const subset=n=>tasks.filter(t=>t.n===n);

test('80 level tasks have stable IDs, real level metadata and no inherited checking or files',()=>{
  assert.equal(tasks.length,80);assert.equal(new Set(tasks.map(t=>t.bankId)).size,80);
  for(let n=1;n<=10;n++)for(const difficulty of ['start','challenge']){
    const group=tasks.filter(t=>t.n===n&&t.difficulty===difficulty);assert.equal(group.length,4);assert.equal(new Set(group.map(t=>t.body)).size,4);
    for(const t of group){assert.equal(t.origin,'authored');assert.equal(t.max,1);assert.equal(t.manual,false);assert.deepEqual(t.images,[]);assert.equal(t.inlineImages,false);assert.ok(t.body.length>100);assert.ok(t.difficultyReason.length>50);assert.ok(t.topic);assert.ok(t.estimatedMinutes>0);assert.ok(t.steps.length>=2);assert.equal(typeof t.key,'string');for(const field of ['grading','download','downloadLabel','solution'])assert.equal(t[field],undefined);if(![5,6].includes(n))assert.equal(t.check,undefined);assert.equal(L.meta(t).difficulty,difficulty);assert.equal(L.meta(t).label,L.labels[difficulty]);}
  }
  const original=structuredClone(O.tasks),before=JSON.stringify(original);L.create(original);assert.equal(JSON.stringify(original),before);
  const dirty=original.map(t=>({...t,grading:{fake:1},download:'wrong.zip',downloadLabel:'wrong',solution:'wrong',check:{type:'wrong'}}));
  assert.ok(L.create(dirty).every(t=>!t.grading&&!t.download&&!t.downloadLabel&&!t.solution&&(!t.check||[5,6].includes(t.n))));
  for(const t of O.tasks){const m=L.meta(t);assert.equal(m.difficulty,'standard');assert.equal(m.label,'По демоверсии');assert.ok(m.topic);assert.ok(m.difficultyReason.includes('сама по себе'));}
  assert.throws(()=>L.create([]));
  const context={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../oge-levels.js'),'utf8'),context);assert.equal(context.OGELevels1430.create(O.tasks).length,80);
});
test('all original 80 short level tasks remain available unchanged in the extended bank',()=>{
  const integrated=O.bank.filter(t=>/^oge-level-(?:start|challenge)-\d+-\d+$/.test(t.bankId)&&t.n<=10);assert.equal(integrated.length,80);
  for(const t of tasks){const saved=O.bankById(t.bankId);assert.ok(saved,t.bankId);for(const field of ['n','body','key','steps','check','difficulty'])assert.deepEqual(saved[field],t[field],`${t.bankId}: ${field}`);}
});

test('all text keys follow from the displayed encoding and both text changes',()=>{
  for(const t of subset(1)){
    const bits=Number(t.body.match(/<strong>(\d+) бит/)[1]);
    if(t.difficulty==='start'){const word=t.body.match(/<strong>«([^»]+)»/)[1];assert.equal(Number(t.key),Buffer.byteLength(word,'utf16le')/2*bits/8,t.bankId);}
    else{const words=t.body.match(/<blockquote>На карте: ([^<]+)/)[1].split(', '),added=Number(t.body.match(/добавил <strong>(\d+)/)[1]),difference=Number(t.body.match(/на <strong>(\d+) байт/)[1]);const possible=words.filter(word=>((word.length+2)-added)*bits/8===difference);assert.deepEqual(possible,[t.key],t.bankId);}
  }
});

function allDecodings(bits,letters,codes){const found=[];function visit(position,text){if(position===bits.length){found.push(text);return;}for(let k=0;k<codes.length;k++)if(bits.startsWith(codes[k],position))visit(position+codes[k].length,text+letters[k]);}visit(0,'');return found;}
test('all messages have exactly one full decoding after the stated transmission operation',()=>{
  for(const t of subset(2)){
    const letters=[...t.body.matchAll(/<th>([^<]+)<\/th>/g)].map(m=>m[1]),codes=rows(t)[0],sent=t.body.match(/<pre>([01]+)<\/pre>/)[1],bits=t.difficulty==='start'?sent:[...sent].reverse().join('');
    assert.deepEqual(allDecodings(bits,letters,codes),[t.key],t.bankId);
    if(t.difficulty==='start')assert.ok(codes.every(c=>c.length===2));else{assert.ok(new Set(codes.map(c=>c.length)).size>1);assert.match(t.body,/в обратном порядке/);}
  }
});

test('all logic answers agree with exhaustive evaluation of the printed expression',()=>{
  for(const t of subset(3)){
    const printed=unescape(t.body.match(/<blockquote>(.*?)<\/blockquote>/)[1]).replace(/\.$/,''),expression=printed.replace(/ИЛИ/g,'||').replace(/НЕ/g,'!').replace(/И/g,'&&').replace(/≥/g,'>=').replace(/≤/g,'<='),evaluate=new Function('x','return '+expression),valid=Array.from({length:40},(_,i)=>i+1).filter(x=>evaluate(x));
    assert.equal(Number(t.key),t.difficulty==='start'?valid[0]:valid.length,t.bankId);assert.ok(valid.length>0);
  }
});

test('every shortest path key is verified with an independent all-pairs calculation',()=>{
  for(const t of subset(4)){
    const edges=rows(t).map(([a,b,w])=>[a,b,Number(w)]),vertices=[...new Set(edges.flatMap(([a,b])=>[a,b]))].sort(),d=vertices.map((a,i)=>vertices.map((b,j)=>i===j?0:Infinity));
    for(const [a,b,w] of edges){const i=vertices.indexOf(a),j=vertices.indexOf(b);d[i][j]=d[j][i]=w;}
    for(let k=0;k<vertices.length;k++)for(let i=0;i<vertices.length;i++)for(let j=0;j<vertices.length;j++)d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);
    const target=t.body.match(/<strong>A в ([A-Z])<\/strong>/)[1];assert.equal(Number(t.key),d[vertices.indexOf('A')][vertices.indexOf(target)],t.bankId);
  }
});

test('every executor version accepts exactly the programs reaching its printed target',()=>{
  const taskFor=O.taskFor;
  try{for(const t of subset(5)){
    const multiply=Number(t.body.match(/умножь на (\d+)/)[1]),addMatch=t.body.match(/2 — (прибавь|вычти) (\d+)/),add=Number(addMatch[2])*(addMatch[1]==='вычти'?-1:1),numbers=[...t.body.matchAll(/числ[ао] <strong>(-?\d+)<\/strong>/g)].map(m=>Number(m[1])),start=numbers[0],target=numbers[1],max=Number(t.body.match(/чем <strong>(\d+)/)[1]);
    assert.ok(Number.isFinite(start)&&Number.isFinite(target));O.taskFor=()=>t;let found=0,minLength=Infinity;
    function enumerate(sequence,value){if(sequence){const correct=value===target;assert.equal(O.correct(5,sequence),correct,t.bankId+':'+sequence);if(correct){found++;minLength=Math.min(minLength,sequence.length);if(t.difficulty==='challenge')assert.ok(sequence.includes('1')&&sequence.includes('2'),t.bankId);}}if(sequence.length<max){enumerate(sequence+'1',value*multiply);enumerate(sequence+'2',value+add);}}
    enumerate('',start);assert.ok(found>0,t.bankId);if(t.difficulty==='challenge')assert.equal(minLength,5,t.bankId);let result=start;for(const c of t.key)result=c==='1'?result*multiply:result+add;assert.equal(result,target,t.bankId);assert.ok(t.key.length<=max);assert.equal(O.correct(5,t.key+'111111'),false);
  }}finally{O.taskFor=taskFor;}
});

test('parameter checks match independent execution of the displayed arithmetic for every integer in a wide range',()=>{
  const taskFor=O.taskFor;
  try{for(const t of subset(6)){
    const pre=[...t.body.matchAll(/<pre(?: class="python")?>([\s\S]*?)<\/pre>/g)].map(m=>unescape(m[1])),condition=pre[0].match(/if (.*):/)[1].replace(/\bor\b/g,'||'),run=new Function('s','t','A','return '+condition),pairs=[...pre[1].matchAll(/\((-?\d+), (-?\d+)\)/g)].map(m=>[Number(m[1]),Number(m[2])]),target=Number(t.body.match(/ровно <strong>(\d+)/)[1]);
    O.taskFor=()=>t;const accepted=[];for(let a=-100;a<=100;a++){const valid=pairs.filter(([s,v])=>run(s,v,a)).length===target;assert.equal(O.correct(6,String(a)),valid,t.bankId+':'+a);if(valid)accepted.push(a);}assert.ok(accepted.includes(Number(t.key)),t.bankId);assert.ok(accepted.length>0&&accepted.length<10);assert.equal(O.correct(6,t.key+'.0'),false);
  }}finally{O.taskFor=taskFor;}
});

test('URL fragment keys reconstruct the exact server, directory order and file from the condition',()=>{
  for(const t of subset(7)){
    const pieces=rows(t)[0],server=t.body.match(/сервере <strong>([^<]+)/)[1],file=t.body.match(/файл <strong>([^<]+)/)[1],protocol=t.body.match(/протокол <strong>([^<]+)/)[1],folders=t.difficulty==='start'?[]:[...t.body.matchAll(/папка <strong>([^<]+)/g)].map(m=>m[1]),indices=[...t.key].map(Number);
    assert.equal(new Set(indices).size,pieces.length);assert.equal(indices.length,pieces.length);assert.equal(indices.map(i=>pieces[i-1]).join(''),protocol+'://'+server+'/'+[...folders,file].join('/'),t.bankId);assert.equal(folders.length,t.difficulty==='start'?0:2);
  }
});

test('set-query keys agree with exact Venn regions reconstructed from the displayed observations',()=>{
  for(const t of subset(8)){
    const data=rows(t),terms=data.slice(0,t.difficulty==='start'?2:3).map(([word])=>word),intersections=new Map(data.map(([query,count])=>[query.split(' & ').reduce((mask,word)=>mask|1<<terms.indexOf(word),0),Number(count)])),regions=new Map();
    for(const mask of [...intersections.keys()].sort((a,b)=>b.toString(2).replace(/0/g,'').length-a.toString(2).replace(/0/g,'').length)){let count=intersections.get(mask);for(const [other,region] of regions)if((other&mask)===mask)count-=region;assert.ok(count>=0,t.bankId);regions.set(mask,count);}
    const universe=[];for(const [mask,count] of regions)for(let i=0;i<count;i++)universe.push(mask);
    const wanted=t.difficulty==='start'?universe.length:universe.filter(mask=>(mask&(mask-1))===0).length;assert.equal(Number(t.key),wanted,t.bankId);
  }
});

test('every directed-path answer matches enumeration with mandatory and forbidden vertices',()=>{
  for(const t of subset(9)){
    const graph=new Map(rows(t).map(([from,to])=>[from,to==='—'?[]:to.split(', ')])),target=t.difficulty==='start'?'D':'H',must=t.difficulty==='start'?null:t.body.match(/проходят через <strong>([A-Z])/)[1],avoid=t.difficulty==='start'?null:t.body.match(/не проходят через ([A-Z])/)[1];let count=0;
    function visit(node,route){assert.ok(!route.includes(node),'Cycles are not allowed in these tasks');const path=[...route,node];if(node===target){if((!must||path.includes(must))&&(!avoid||!path.includes(avoid)))count++;return;}for(const next of graph.get(node))visit(next,path);}
    visit('A',[]);assert.equal(Number(t.key),count,t.bankId);assert.ok(count>0,t.bankId);
  }
});

test('base-conversion and mixed expressions are evaluated directly from their printed digits',()=>{
  for(const t of subset(10)){
    const values=[...t.body.matchAll(/([0-9A-F]+)<sub>(2|8|10|16)<\/sub>/g)].map(m=>parseInt(m[1],Number(m[2])));assert.equal(values.length,t.difficulty==='start'?1:4);assert.equal(Number(t.key),t.difficulty==='start'?values[0]:(values[0]+values[1])*values[2]-values[3],t.bankId);
  }
});
