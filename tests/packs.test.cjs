const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const C=require('../bank.js');
const tasks=C.bank.filter(b=>b.task.authored);
function independent(t){
  const v=t.verification.input;
  switch(t.verification.model){
    case'kilobytes':return [v.kb*2**10];
    case'bytes-bits':return [v.bytes*2**3];
    case'ram-free':return [v.total-[v.system,...Array(v.apps).fill(v.each)].reduce((a,b)=>a+b,0)];
    case'files-fit':{let used=0,n=0;while(used+v.size<=v.kb*1024){used+=v.size;n++;}return [n];}
    case'phrase-size':return [Array.from(v.phrase).length*(v.bits===8?1:2)];
    case'alphabet-bits':{let capacity=1,bits=0;while(capacity<v.alphabet){capacity*=2;bits++;}return [bits];}
    case'message-length':return [v.bytes/(v.bits/8)];
    case'recoding':return [v.count*v.after/8-v.count*v.before/8];
    case'transfer-volume':return [(v.rate*1024*v.seconds)/8192];
    case'two-connections':return [v.part*(v.rate1+v.rate2)/(v.rate1*v.rate2)];
    case'raster-size':return [v.height*(v.width*v.depth/8)/1024];
    case'palette-size':{let bits=0;while(2**bits<v.colors)bits++;return [v.width*v.height*bits/8];}
    case'input-devices':{const input=new Set(['Клавиатура','Мышь','Сканер','Микрофон','Веб-камера']);return [v.devices.map(d=>d[0]).filter(n=>input.has(n))];}
    case'device-roles':{const groups={'Клавиатура':'Ввод','Мышь':'Ввод','Сканер':'Ввод','Микрофон':'Ввод','Веб-камера':'Ввод','Монитор':'Вывод','Принтер':'Вывод','Колонки':'Вывод','SSD-накопитель':'Хранение','Жёсткий диск':'Хранение','USB-флеш-накопитель':'Хранение','Карта памяти':'Хранение','Центральный процессор':'Обработка','Графический процессор':'Обработка'};return v.names.map(n=>groups[n]);}
    case'pixel-scale':return [(v.width*v.factor)*(v.height*v.factor)];
    case'sound-duration':return [(v.kb*1024)/(v.hz*v.channels*(v.bits/8))];
    case'sound-change':{const duration=v.kb*8192/(v.hz*v.channels*v.bits);return [duration*v.newHz*v.newChannels*v.newBits/8192];}
    case'file-move':{const basename=v.from.slice(v.from.lastIndexOf('\\')+1);return [v.folder+'\\'+basename];}
    case'file-mask':{const matches=name=>{const memo=new Map();function at(m,n){const key=m+','+n;if(memo.has(key))return memo.get(key);const ok=m===v.mask.length?n===name.length:v.mask[m]==='*'?at(m+1,n)||(n<name.length&&at(m,n+1)):n<name.length&&(v.mask[m]==='?'||v.mask[m]===name[n])&&at(m+1,n+1);memo.set(key,ok);return ok;}return at(0,0);};return [v.options.filter(matches)];}
    case'url-address':return [new URL(v.folder+'/'+v.file,'https://'+v.host+'/').href];
    case'folder-volume':{let sum=0;for(let j=0;j<v.counts.length;j++)for(let k=0;k<v.counts[j];k++)sum+=v.sizes[j];return [sum];}
    case'logic-check':{const a=!(v.a<=v.left),b=!(v.b>v.right);return [(v.op==='И'?a&&b:!(!a&&!b))?'ДА':'НЕТ'];}
    case'logic-interval':{let count=0;for(let x=0;x<=v.end;x++)if(x>=v.left+1&&x<=v.right-1&&x%v.divisor>0)count++;return [count];}
    case'logic-grid':{let count=0;for(const s of v.s)for(const k of v.k){const a=s<=v.sLimit,b=k>v.kLimit;if(v.op==='and'?!(!a||!b):!(!a&&!b))count++;}return [count];}
    case'linear-algorithm':{let x=v.start;x*=v.multiplier;x+=v.add;x-=v.subtract;return [x];}
    case'loop-sum':{const n=Math.ceil((v.stop-v.start)/v.step),last=v.start+(n-1)*v.step;return [(v.start+last)*n/2];}
    case'conditional-sum':{const n=Math.floor((v.stop-1)/v.divisor);return [v.divisor*n*(n+1)/2];}
    case'while-counter':return [Math.ceil((v.limit-v.start)/v.step)];
    case'division-remainder':{let remainder=v.n,quotient=0;while(remainder>=v.d){remainder-=v.d;quotient++;}return [quotient+remainder];}
    case'fixed-decoding':{const codes={'00':'А','01':'Б','10':'В','11':'Г'};let out='';for(let j=0;j<v.binary.length;j+=2)out+=codes[v.binary.slice(j,j+2)];return [out];}
    case'text-replace':return [v.phrase.replaceAll(v.from,v.to).length];
    case'table-grid':{let cells=v.rows*v.columns;cells+=v.addRows*v.columns;cells+=(v.rows+v.addRows)*v.addColumns;return [cells];}
    default:throw Error('No independent check for '+t.verification.model);
  }
}
test('all 3265 authored tasks have independent answer checks across 32 models',()=>{
  assert.equal(tasks.length,3265);assert.equal(C.taskPacks.length,32);
  for(const {id,task:t} of tasks){const expected=independent(t);assert.equal(expected.length,t.fields.length,id);for(const [j,f] of t.fields.entries())assert.ok(C.fieldCorrect(f,expected[j]),`${id}: expected ${JSON.stringify(expected[j])}, key ${JSON.stringify(f.correct)}`);}
});
test('3333 unique conditions; stable IDs; honest provenance and no missing answer options',()=>{
  assert.equal(new Set(C.bank.map(b=>b.id)).size,3333);
  assert.equal(new Set(C.bank.map(b=>b.task.body)).size,3333);
  assert.deepEqual(C.bankStats,{total:3333,source:28,practice:3305,authored:3265,practiceFamilies:42,families:60});
  for(const b of C.bank){const t=b.task;assert.ok(t.skills.length&&t.given.length&&t.steps.length&&t.prompt,b.id);for(const f of t.fields){assert.ok(Array.isArray(f.correct)?f.correct.length:String(f.correct).length);if(f.options){assert.equal(new Set(f.options).size,f.options.length);for(const key of Array.isArray(f.correct)?f.correct:[f.correct])assert.ok(f.options.includes(key),b.id);}}if(t.authored){assert.equal(t.sourceImage,undefined);assert.equal(t.sourceStatus,'authored');assert.match(t.source,/учебная модель/);}}
});
test('reviewed baseline of 1000 records remains stable; authored records retain their original content',()=>{
  const originalCounts=new Map(C.taskPacks.map((p,index)=>[p.id,index<4?30:29]));
  const legacy=C.bank.filter(b=>!b.task.authored||b.number<=originalCounts.get(b.task.verification.model));
  assert.equal(legacy.length,1000);
  // Reviewed 2026-10-18: advanced-4 now states the size order explicitly.
  // Keys and IDs are unchanged; the authored-only pre-expansion hash below is unchanged.
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'74a7c3f6be947a39049aba88b21563982214e0d505dd4e8b2e1a4cf37138eee9');
  assert.equal(createHash('sha256').update(JSON.stringify(legacy.filter(b=>b.task.authored).map(b=>[b.id,b.task]))).digest('hex'),'585fa5221b2073c8442fc1624168b50b08f34be27e210a785520ef83c89af881');
});
test('balanced levels, finite model capacity and meaningful new conditions',()=>{
  assert.equal(C.bank.filter(b=>b.level==='base').length,1666);
  assert.equal(C.bank.filter(b=>b.level==='advanced').length,1667);
  const pack=id=>C.bank.filter(b=>b.task.verification?.model===id);
  assert.equal(pack('device-roles').length,60);
  assert.equal(new Set(pack('device-roles').map(b=>JSON.stringify(b.task.verification.input.names))).size,60);
  assert.ok(pack('input-devices').length<=250);
  assert.ok(pack('fixed-decoding').every(b=>/^[01]{10}$/.test(b.task.verification.input.binary)));
  const intervals=pack('logic-interval').filter(b=>b.number>29).map(b=>{const {left,right,end,divisor}=b.task.verification.input;return JSON.stringify([left+1,Math.min(right-1,end),divisor]);});
  assert.equal(new Set(intervals).size,intervals.length);
  const phrases=pack('phrase-size').filter(b=>b.number>29).map(b=>b.task.verification.input.phrase);
  assert.equal(new Set(phrases).size,phrases.length);assert.ok(phrases.every(p=>!/[0-9]/.test(p)));
  const replacements=pack('text-replace').filter(b=>b.number>29).map(b=>b.task.verification.input.phrase);
  assert.equal(new Set(replacements).size,replacements.length);assert.ok(replacements.every(p=>!/[0-9]/.test(p)));
  const masks=pack('file-mask').filter(b=>b.number>29);
  assert.ok(new Set(masks.map(b=>b.task.fields[0].correct.length)).size>=3);
  assert.ok(masks.some(b=>b.task.verification.input.mask.includes('*')));
  assert.ok(new Set(pack('logic-check').filter(b=>b.number>29).map(b=>b.task.fields[0].correct)).size===2);
  assert.ok(new Set(pack('logic-grid').filter(b=>b.number>29).map(b=>b.task.fields[0].correct)).size>=6);
});
test('30-task mixed variants cover every theme with five different families; 12-task levels remain feasible',()=>{
  const topics=[...new Set(C.bank.map(b=>b.task.topic))];
  for(let seed=1;seed<=40;seed++){let state=seed;const rng=()=>((state=(state*1664525+1013904223)>>>0)/2**32);const v=C.autoVariant({count:30,topics},rng);const rows=v.taskIds.map(id=>C.bank.find(b=>b.id===id));assert.equal(new Set(rows.map(b=>b.task.family)).size,30);for(const topic of topics)assert.equal(rows.filter(b=>b.task.topic===topic).length,5);}
  for(const level of ['base','advanced']){const v=C.autoVariant({count:12,topics,level});assert.equal(v.taskIds.length,12);assert.ok(v.taskIds.every(id=>C.bank.find(b=>b.id===id).level===level));}
});
test('new tasks support score/import, incorrect answers and frozen teacher revisions',()=>{
  const ids=C.taskPacks.map(p=>`pack-${p.id}-${p.count}`),answers=ids.map(id=>C.bank.find(b=>b.id===id).task.fields.map(f=>structuredClone(f.correct)));
  const a={schema:1,id:'packs-fixture',name:'Ученик',schoolClass:'7 А',level:'custom',customTitle:'Новые модели',minutes:120,taskIds:ids,answers,events:[],startedAt:1,finishedAt:100};
  assert.equal(C.score(C.validateAttempt(a)).points,32);
  assert.equal(C.score({...a,answers:ids.map(()=>[])}).points,0);
  const edit={fullText:'Новое учебное условие.',correct:['1'],steps:['Проверенный учителем разбор.'],reviewer:'Учитель',revision:1};
  const frozen=C.validateAttempt({...a,taskEdits:{[ids[0]]:edit},answers:[['1'],...answers.slice(1)]});
  assert.equal(C.score(frozen).points,32);assert.notEqual(C.bank.find(b=>b.id===ids[0]).task.fields[0].correct,'1');
});
