const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const O=require('../oge-core.js'),Zip=require('../oge-zip.js');
const selected=t=>({taskNumbers:[t.n],taskIds:{[t.n]:t.bankId},selectionMode:O.selectionMode});
const legacyAuthored=t=>/^oge-authored-\d+-\d+$/.test(t.bankId);
const difficultyLabels={start:'Разминка',standard:'По демоверсии',challenge:'Усложнённый'};
test('OGE bank has 400 unique tasks with difficulty metadata and accepted stored keys',()=>{
  assert.equal(O.tasks.length,16);assert.equal(O.bank.length,400);assert.equal(new Set(O.bank.map(t=>t.bankId)).size,400);assert.equal(O.authoredCount,384);
  for(let n=1;n<=16;n++){const set=O.bank.filter(t=>t.n===n),count=25;assert.equal(set.length,count);assert.equal(set.filter(t=>t.origin==='authored').length,count-1);assert.equal(set.filter(t=>t.origin==='fipi').length,1);assert.equal(new Set(set.map(t=>t.body)).size,count,`unique statements for №${n}`);assert.equal(set.filter(t=>t.difficulty==='standard').length,17);for(const level of ['start','challenge'])assert.equal(set.filter(t=>t.difficulty===level).length,4);for(const t of set){assert.ok(t.body.length>50,t.bankId);assert.ok(t.steps.length>=2,t.bankId);assert.ok(t.steps.every(step=>typeof step==='string'&&step.trim()),t.bankId);assert.ok(typeof t.title==='string'&&t.title.trim(),t.bankId);assert.ok(typeof t.sourceLabel==='string'&&t.sourceLabel.trim(),t.bankId);assert.ok(['start','standard','challenge'].includes(t.difficulty),t.bankId);assert.equal(t.max,n===14?3:n>=13?2:1);if(n<=12)assert.ok(O.correct(n,t.key,selected(t)),t.bankId);else assert.ok(t.manual);}}
  assert.deepEqual(O.tasks.map(t=>t.key),['физика','БАВГ','8','9','12122','10','4751632','470','7','1032','городовой','8',null,null,null,null]);
});
test('every OGE difficulty is explained and has usable topic and duration metadata',()=>{
  for(const t of O.bank){assert.equal(t.label,difficultyLabels[t.difficulty],t.bankId);assert.ok(typeof t.difficultyReason==='string'&&t.difficultyReason.trim(),t.bankId);assert.ok(typeof t.topic==='string'&&t.topic.trim(),t.bankId);assert.ok(Number.isFinite(t.estimatedMinutes)&&t.estimatedMinutes>0,t.bankId);}
});
test('the original 272 bank IDs, statements and answer keys remain unchanged',()=>{
  const legacy=O.bank.filter(t=>/^oge-(?:fipi|authored)-/.test(t.bankId)).sort((a,b)=>a.bankId.localeCompare(b.bankId,'en'));
  assert.equal(legacy.length,272);for(let n=1;n<=16;n++){assert.equal(O.bankById(`oge-fipi-${n}`).origin,'fipi');for(let i=1;i<=16;i++)assert.equal(O.bankById(`oge-authored-${n}-${i}`).difficulty,'standard');}
  const digest=require('node:crypto').createHash('sha256').update(JSON.stringify(legacy.map(t=>[t.bankId,t.body,t.key]))).digest('hex');
  assert.equal(digest,'39b7b70c8ac18c29390828a6fd84efdad2294bdb3e7bdca98457c9ccf5025b8b');
});
test('text encoding statements uniquely identify the removed word for every authored variant',()=>{
  for(const t of O.bank.filter(t=>t.n===1&&legacyAuthored(t))){const words=t.body.match(/<blockquote>На карте: (.*?)<\/blockquote>/)[1].split(', '),bits=Number(t.body.match(/<strong>(\d+) бит/)[1]),bytes=Number(t.body.match(/<strong>(\d+) байт/)[1]);assert.equal(new Set(words.map(w=>w.length)).size,words.length,t.bankId);assert.deepEqual(words.filter(w=>(w.length+2)*bits/8===bytes),[t.key]);}
});
test('cipher messages are prefix free and independently decode to their stored keys',()=>{
  for(const t of O.bank.filter(t=>t.n===2&&legacyAuthored(t))){const letters=[...t.body.matchAll(/<th>(.*?)<\/th>/g)].map(m=>m[1]),codes=[...t.body.matchAll(/<td>(.*?)<\/td>/g)].map(m=>m[1]);for(let i=0;i<codes.length;i++)for(let j=0;j<codes.length;j++)if(i!==j)assert.ok(!codes[j].startsWith(codes[i]));let bits=t.body.match(/<pre>(.*?)<\/pre>/)[1],decoded='';while(bits){const k=codes.findIndex(c=>bits.startsWith(c));assert.ok(k>=0);decoded+=letters[k];bits=bits.slice(codes[k].length);}assert.equal(decoded,t.key);}
});
test('all valid executor programs and parameter values are accepted, including alternatives',()=>{
  for(const t of O.bank.filter(t=>legacyAuthored(t)&&[5,6].includes(t.n))){const a=selected(t),r=t.check;if(t.n===5){const visit=(s,x)=>{if(s)assert.equal(O.correct(5,s,a),x===r.target,`${t.bankId}:${s}`);if(s.length<r.maxCommands){visit(s+'1',x*r.multiply);visit(s+'2',x+r.add);}};visit('',r.start);assert.ok(!O.correct(5,t.key+'2',a));}else{const accepted=[];for(let v=-50;v<=100;v++){const expected=r.pairs.reduce((sum,[s,t])=>sum+(s>r.threshold||t>v?1:0),0)===r.targetCount;assert.equal(O.correct(6,String(v),a),expected);if(expected)accepted.push(v);}assert.equal(accepted.length,3);assert.ok(accepted.includes(Number(t.key)));assert.ok(!O.correct(6,t.key+'.0',a));}}
});
test('shortest-path, directed-path and base-conversion keys match independent calculations',()=>{
  const cells=t=>[...t.body.matchAll(/<tr>(.*?)<\/tr>/g)].slice(1).map(m=>[...m[1].matchAll(/<td>(.*?)<\/td>/g)].map(m=>m[1]));
  for(const t of O.bank.filter(t=>legacyAuthored(t)&&[4,9,10].includes(t.n))){if(t.n===4){const rows=cells(t),d=Array(6).fill(Infinity),done=new Set();d[0]=0;for(let k=0;k<6;k++){let at=-1;for(let j=0;j<6;j++)if(!done.has(j)&&(at<0||d[j]<d[at]))at=j;done.add(at);for(let j=0;j<6;j++){const v=Number(rows[at][j+1]);if(Number.isFinite(v))d[j]=Math.min(d[j],d[at]+v);}}assert.equal(Number(t.key),d[5]);}else if(t.n===9){const rows=cells(t),count=new Map([['A',1]]);for(const [from,to] of rows)if(to!=='—')for(const target of to.split(', '))count.set(target,(count.get(target)||0)+(count.get(from)||0));assert.equal(Number(t.key),count.get('H'));}else{const values=[...t.body.matchAll(/([0-9A-F]+)<sub>(2|8|16)<\/sub>/g)].map(m=>parseInt(m[1],Number(m[2])));assert.equal(values.length,3);assert.equal(values.reduce((a,b)=>a+b),Number(t.key));}}
});
test('all authored search/file archives exist, unzip safely and yield their stated answers',async()=>{
  for(const t of O.bank.filter(t=>legacyAuthored(t)&&[11,12].includes(t.n))){const bytes=fs.readFileSync(path.join(__dirname,'..',t.asset,t.download)),files=await Zip.read(bytes);assert.ok(files.size>=4);if(t.n===11){const surname=t.body.match(/фамилии <strong>([^<]+)/)[1],hits=[...files.values()].map(v=>Buffer.from(v).toString('utf8')).filter(text=>text.includes(surname));assert.equal(hits.length,1);assert.ok(hits[0].includes(`— ${t.key}.`));}else{const ext=t.body.match(/расширениями <strong>(.*?)<\/strong>/)[1].split(' и '),count=[...files.keys()].filter(name=>/\/(Север|Восток)\//.test(name)&&ext.some(e=>name.toLowerCase().endsWith(e))).length;assert.equal(count,Number(t.key),t.bankId);}}
});
test('score and task lookup use the selected variant while legacy answers keep their original keys',()=>{
  const t=O.bankById('oge-authored-10-16'),a={...selected(t),answers:Array(16).fill(''),files:{},marks:{},mode:'practice'};a.answers[9]=t.key;assert.equal(O.taskFor(a,10),t);assert.equal(O.tasksFor(a)[0],t);assert.equal(O.score(a).points,1);assert.equal(O.correct(10,O.tasks[9].key,a),false);assert.equal(O.correct(10,O.tasks[9].key),true);
});
