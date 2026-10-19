const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const O=require('../dist/oge-core.js'),G=require('../dist/oge-program-grader.js'),P=require('../dist/oge-practice-bank.js');
const root=path.resolve(__dirname,'../dist'),tasks=O.bank.filter(t=>t.n>=11),byId=new Map(tasks.map(t=>[t.bankId,{id:t.bankId,n:t.n,difficulty:t.difficulty,origin:t.origin,status:'pending',checks:[],issues:[],repaired:[],limitations:[]}])) ,cache=new Map();
const normalize=s=>String(s).normalize('NFC').replace(/ё/gi,'е').replace(/\s+/g,' ').trim().toLowerCase();
function decodeXML(s){return String(s).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function plain(s){return decodeXML(String(s).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
function check(t,id,label,fn){const row=byId.get(t.bankId);try{const detail=fn();row.checks.push({id,label,passed:true,...(detail===undefined?{}:{detail})});}catch(error){row.checks.push({id,label,passed:false});row.issues.push({id,message:error.message});throw error;}}
// Source archives can exceed the deliberately small student-file ZIP budget.
// This independent reader only reads committed fixtures with Node's bounded zlib.
function archive(t){
  const filename=path.join(root,t.asset||O.asset,t.download);if(cache.has(filename))return cache.get(filename);
  const bytes=fs.readFileSync(filename);let end=bytes.length-22;while(end>=Math.max(0,bytes.length-65557)&&bytes.readUInt32LE(end)!==0x06054b50)end--;
  assert.ok(end>=0,'ZIP end record');let pos=bytes.readUInt32LE(end+16);const result=new Map(),count=bytes.readUInt16LE(end+10);
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(pos),0x02014b50);const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),compressed=bytes.readUInt32LE(pos+20),size=bytes.readUInt32LE(pos+24),length=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),offset=bytes.readUInt32LE(pos+42);
    const name=new TextDecoder(flags&0x800?'utf-8':'ibm866').decode(bytes.subarray(pos+46,pos+46+length)).normalize('NFC').replace(/\\/g,'/');
    assert.ok(!result.has(name),'unique archive entry '+name);assert.ok(!(flags&1),'unencrypted source archive');
    result.set(name,{size,read(){assert.equal(bytes.readUInt32LE(offset),0x04034b50);const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28),raw=bytes.subarray(start,start+compressed);assert.ok(size<=64*1024*1024,'source entry bound');const data=method===0?raw:method===8?zlib.inflateRawSync(raw,{maxOutputLength:64*1024*1024}):assert.fail('unsupported source compression');assert.equal(data.length,size);return data;}});
    pos+=46+length+extra+comment;
  }
  cache.set(filename,result);return result;
}
function sourceText(entry){const bytes=entry.read();try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1251').decode(bytes);}}
function sheetRows(t){
  const xml=sourceText(archive(t).get('content.xml')),out=[];
  for(const m of xml.matchAll(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g)){
    const cells=[];for(const cell of m[1].matchAll(/<table:table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)){const repeated=Number(cell[1].match(/table:number-columns-repeated="(\d+)"/)?.[1]||1);for(let i=0;i<Math.min(repeated,4-cells.length);i++)cells.push(cell);if(cells.length===4)break;}
    if(cells.length!==4)continue;const title=plain(cells[0][2]||'');if(!/^участник\s*\d+$/i.test(title))continue;
    const values=cells.slice(1).map(c=>Number(c[1].match(/office:value="([^"]+)"/)?.[1]));assert.ok(values.every(Number.isFinite),'numeric source fields');out.push([title,...values]);
  }
  return out;
}

test('practical audit covers all 150 stable IDs with files, explanations and honest grading scope',()=>{
  assert.equal(tasks.length,150);assert.equal(byId.size,150);
  for(let n=11;n<=16;n++)assert.equal(tasks.filter(t=>t.n===n).length,25);
  for(const t of tasks)check(t,'metadata','Condition, explanation and source file are present',()=>{
    assert.ok(t.body.length>100);assert.ok(Array.isArray(t.steps)&&t.steps.length>=2);assert.equal(t.max,t.n===14?3:t.n>=13?2:1);assert.equal(!!t.manual,t.n>=13);
    if(t.download){assert.ok(fs.existsSync(path.join(root,t.asset||O.asset,t.download)));byId.get(t.bankId).source={file:(t.asset||O.asset)+t.download,bytes:fs.statSync(path.join(root,t.asset||O.asset,t.download)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,t.asset||O.asset,t.download))).digest('hex')};}
    if(t.n>=13)assert.ok(t.criteria);
  });
});

test('all 25 search answers follow actual source text, including surname decoys and combined fields',()=>{
  for(const t of tasks.filter(t=>t.n===11))check(t,'archive-search','Exactly one matching source record yields the displayed answer',()=>{
    const entries=archive(t),documents=[...entries].filter(([name])=>/\.(txt|htm|html|rtf)$/i.test(name));
    if(t.origin==='fipi'){
      const surname=t.body.match(/фамилии ([А-ЯЁ][а-яё]+)/)[1],sources=documents.filter(([name])=>name.startsWith('Проза/Чехов/')&&/\.html?$/i.test(name));
      const matches=sources.flatMap(([name,entry])=>{const text=plain(sourceText(entry)),pattern=new RegExp('(?:городов(?:ой|ому|ого).{0,100}'+surname+'|'+surname+'.{0,100}городов(?:ой|ому|ого))','gi');return [...text.matchAll(pattern)].map(()=>name);});assert.ok(matches.length>0,'source text identifies Елдырин as городовой');assert.equal(normalize(t.key),'городовой');return {matchingDocuments:[...new Set(matches)],answer:t.key};
    }
    const surname=t.body.match(/фамилии <strong>([^<]+)/)[1];let matches;
    if(t.bankId.startsWith('oge-level-')){
      const records=documents.map(([name,entry])=>({name,fields:Object.fromEntries(sourceText(entry).trim().split(/\r?\n/).map(line=>line.split(/:\s*/)))}));matches=records.filter(r=>r.fields['Фамилия']===surname);
      if(t.difficulty==='challenge'){assert.ok(matches.length>1,'decoys share the surname');const city=t.body.match(/города <strong>([^<]+)/)[1],year=Number(t.body.match(/раньше (\d+) года/)[1]);matches=matches.filter(r=>r.fields['Город']===city&&Number(r.fields['Год приёма'])>=year);}
      assert.equal(matches.length,1,t.bankId);assert.equal(matches[0].fields['Профессия'],t.key);
    }else{
      const pattern=new RegExp(surname+'\\s*[—-]\\s*([а-яё]+)','gi');matches=documents.flatMap(([name,entry])=>[...sourceText(entry).matchAll(pattern)].map(m=>({name,role:m[1]})));assert.equal(matches.length,1);assert.equal(matches[0].role,t.key);
    }
    assert.ok(O.correct(11,t.key,{selectionMode:O.selectionMode,taskIds:{11:t.bankId}}));return {matches:matches.length,answer:t.key};
  });
});

test('all 25 file counts follow exact directories, last extensions, case and excluded subtrees',()=>{
  for(const t of tasks.filter(t=>t.n===12))check(t,'archive-count','Independent archive traversal reproduces the answer',()=>{
    const names=[...archive(t).keys()].filter(name=>!name.endsWith('/'));let accepted;
    if(t.origin==='fipi'){
      const prefixes=[...t.body.matchAll(/подкаталогах <strong>([^<]+)<\/strong> каталога <strong>([^<]+)/g)].flatMap(m=>m[1].split(' и ').map(folder=>m[2]+'/'+folder+'/'));assert.equal(prefixes.length,4);
      accepted=names.filter(name=>prefixes.some(p=>name.startsWith(p))&&/\.(jpeg|pdf)$/i.test(name));
    }else if(t.bankId.startsWith('oge-level-')){
      accepted=names.filter(name=>{const parts=name.split('/'),file=parts.at(-1),extension=file.slice(file.lastIndexOf('.')+1).toLowerCase();return t.difficulty==='start'?parts.length===2&&parts[0]==='Материалы'&&extension==='txt':parts[0]==='Проект'&&!parts.slice(0,-1).includes('Черновики')&&!file.startsWith('~')&&['txt','csv'].includes(extension);});
      if(t.difficulty==='challenge'){assert.ok(names.some(n=>n.endsWith('.TXT')));assert.ok(names.some(n=>n.includes('/Черновики/')));assert.ok(names.some(n=>n.split('/').at(-1).startsWith('~')));}
    }else{
      const extensions=t.body.match(/расширениями <strong>([^<]+)/)[1].split(' и ');accepted=names.filter(name=>{const parts=name.split('/');return ['Север','Восток'].includes(parts[1])&&extensions.includes('.'+parts.at(-1).split('.').at(-1).toLowerCase());});assert.ok(names.some(n=>n.includes('/Запад/')));assert.ok(names.some(n=>n.endsWith('.pdf.txt')));
    }
    assert.equal(accepted.length,Number(t.key),t.bankId);return {files:accepted.length,matchedPaths:accepted};
  });
});

test('all 25 office conditions match their grading parameters, supplied texts and embedded source images',()=>{
  for(const t of tasks.filter(t=>t.n===13))check(t,'office-contract','Archive contents and grading requirements match the stated task',()=>{
    const files=archive(t),g=t.grading,record=byId.get(t.bankId);assert.ok([...files.keys()].some(name=>/\.(jpe?g|png|svg)$/i.test(name)),'images are supplied');
    if(g?.kind==='level-office'){
      assert.equal(Number(t.body.match(/ровно (\d+) слайда/)[1]),g.slides.length);assert.equal(g.slides[0].images,0);assert.ok(g.slides.slice(1).every(s=>s.images===1));
      const texts=sourceText(files.get('Тексты.txt')),condition=plain(t.body);for(const text of [g.title,...g.paras,...g.list,...g.table.flat(),...g.slides.flatMap(s=>[s.title,...s.paragraphs])]){assert.ok(texts.includes(text),'archive includes '+text);assert.ok(condition.includes(text),'condition includes '+text);}
      assert.ok(sourceText(files.get('Иллюстрация.svg')).includes(g.title));assert.equal(g.table.length,g.level==='start'?3:5);assert.equal(g.paras.length,g.level==='start'?1:3);assert.equal(g.list.length,g.level==='start'?0:3);
    }else if(g){
      const sizes=t.body.match(/Заголовок титула — (\d+) пт, подзаголовок и заголовки слайдов 2–3 — (\d+) пт, остальной текст — (\d+) пт/);assert.deepEqual(sizes.slice(1).map(Number),[g.slideTitle,g.slideHeading,g.slideBody]);
      const document=t.body.match(/основного текста — (\d+) пт; таблицы — (\d+) пт/);assert.deepEqual(document.slice(1).map(Number),[g.documentFont,g.tableFont]);assert.match(t.body,new RegExp('первая строка '+g.indentCm+' см'));
    }else{assert.ok(t.steps.join(' ').includes('40/24/20'));assert.ok(t.criteria.includes('13.1')&&t.criteria.includes('13.2'));}
    record.repaired.push('Typeface families, SMIL transitions and slide boundaries are checked; level heading line spacing accepts equivalent units.');
    record.limitations.push('Image identity/source authenticity, semantic quality and actual text overflow require teacher visual review; automated geometry and formatting checks are finite.');
    return {gradingKind:g?.kind||'fipi-office',formats:['odp','odt'],archiveEntries:files.size};
  });
});

test('all 25 spreadsheet source datasets independently reproduce filters, averages, chart aggregates and explanations',()=>{
  for(const t of tasks.filter(t=>t.n===14))check(t,'source-dataset','Raw committed rows reproduce every required numerical answer',()=>{
    const rows=sheetRows(t),g=t.grading,body=plain(t.body);assert.equal(rows.length,g?.rowCount||1000);assert.equal(new Set(rows.map(r=>normalize(r[0]))).size,rows.length);let selected,count;
    if(!g){count=rows.filter(r=>r[2]===8&&r[3]>210).length;selected=rows.filter(r=>r[1]===2);}
    else if(g.kind==='authored-spreadsheet'){const cls=Number(body.match(/учеников (\d+) класса/)[1]),threshold=Number(body.match(/более (\d+)/)[1]),school=Number(body.match(/школы №(\d+)/)[1]);count=rows.filter(r=>r[2]===cls&&r[3]>threshold).length;selected=rows.filter(r=>r[1]===school);}
    else if(t.difficulty==='start'){const threshold=Number(body.match(/более (\d+)/)[1]);count=rows.filter(r=>r[3]>threshold).length;selected=rows;}
    else{const school=Number(body.match(/№(\d+)/)[1]),minimum=Number(body.match(/менее (\d+)/)[1]);count=rows.filter(r=>[7,9].includes(r[2])&&r[1]===school&&r[3]>180).length;selected=rows.filter(r=>r[2]===8&&r[3]>=minimum);}
    assert.ok(selected.length);const mean=selected.reduce((s,r)=>s+r[3],0)/selected.length,chart=Object.fromEntries([7,8,9].map(c=>[c,rows.filter(r=>r[2]===c).reduce((s,r)=>s+(body.includes('суммы баллов')?r[3]:1),0)]));
    assert.equal(count,g?.answer1??107);assert.ok(Math.abs(mean-(g?.answer2??230.63))<(g?1e-9:.0051));assert.deepEqual(chart,g?.chart||{7:219,8:198,9:210});
    assert.ok(t.steps.join(' ').includes(String(count)));assert.ok(t.steps.join(' ').includes(mean.toFixed(2).replace('.',',')));for(const value of Object.values(chart))assert.ok(t.steps.join(' ').includes(String(value)));
    if(g){let hash=2166136261;for(const r of rows)for(const c of r.join('|')+';'){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}assert.equal(hash,g.sourceHash);}
    const record=byId.get(t.bankId);record.repaired.push('Source formulas and chart formulas are recalculated; stale caches and extra participants cannot earn points. Unsupported source formulas remain explicitly unverified.');
    record.limitations.push('Spreadsheet formulas use a bounded safe interpreter; unsupported formulas require a saved numeric result or teacher review.');return {rows:rows.length,count,mean,chart};
  });
});

test('all 25 Robot variants have matching orientation, exact target counts and passing boundary geometries',()=>{
  for(const t of tasks.filter(t=>t.n===15))check(t,'robot-worlds','Canonical algorithm passes independently checked geometry counts and directions',()=>{
    const g=t.grading,source=t.solution||P.robotSolution(1),result=G.grade15(source,{grading:g});assert.equal(result.points,2,t.bankId);assert.ok(result.testResults.every(r=>r.ok));
    if(g?.kind==='level-robot-strip'){
      const orientation=[['вправо','снизу','сверху'],['вниз','слева','справа'],['влево','сверху','снизу'],['вверх','справа','слева']][g.rotation];assert.ok(t.body.includes('<strong>'+orientation[1]+'</strong>'));assert.ok(t.body.includes('<strong>'+orientation[0]+'</strong>'));assert.ok(source.includes(orientation[0]));
      for(const r of result.testResults){const roofs=Array.from({length:r.length},(_,x)=>x).filter(x=>(x+r.phase)%r.period===0).length;assert.equal(r.required,r.length-(g.level==='challenge'?roofs:0));}assert.ok(result.testResults.some(r=>r.length===1));assert.ok(result.testResults.some(r=>r.length===512));
    }else{
      if(g){const [up,right,down,left]=[['вверх','вправо','вниз','влево'],['вправо','вниз','влево','вверх'],['вниз','влево','вверх','вправо'],['влево','вверх','вправо','вниз'],['вверх','влево','вниз','вправо'],['вправо','вверх','влево','вниз'],['вниз','вправо','вверх','влево'],['влево','вниз','вправо','вверх']][g.transform];assert.ok(t.body.includes('<strong>'+up+', затем '+right+'</strong>'));assert.ok(t.body.includes('<strong>'+right+', затем '+down+'</strong>'));assert.ok(source.includes(left==='влево'?'слева':left==='вправо'?'справа':left==='вверх'?'сверху':'снизу'));}
      for(const r of result.testResults)assert.equal(r.required,g?.targetMode==='ascent'?r.up+1:r.up+r.down+1);assert.equal(result.testResults.length,21);assert.ok(result.testResults.some(r=>r.up===512&&r.down===512));
    }
    assert.equal(G.grade15('нач\nкон',{grading:g}).points,0);byId.get(t.bankId).limitations.push('Robot grading covers a finite set of fields, including lengths 1 and 512; it is not a proof for every permitted geometry.');return {geometries:result.testResults.length,maxRequired:Math.max(...result.testResults.map(r=>r.required))};
  });
});

test('all 25 Python variants agree with an independent oracle for every published boundary test',()=>{
  for(const t of tasks.filter(t=>t.n===16))check(t,'python-oracle','Displayed conditions reproduce every test expectation and canonical output',()=>{
    const g=t.grading,source=t.solution,result=G.grade16(source,{grading:g,filename:'answer.py'});assert.equal(result.points,2,t.bankId);assert.ok(result.testResults.every(r=>r.ok));const body=plain(t.body);let oracle;
    if(g?.kind==='level-sequence'){
      const divisor=Number(body.match(/делит?ся на (\d+)/)?.[1]||t.body.match(/<strong>(\d+)<\/strong>/)[1]),threshold=g.level==='challenge'?Number(body.match(/больше (\d+)/)[1]):null;
      oracle=values=>g.level==='start'?values.filter(x=>x%divisor===0).length:values.slice(1).filter((x,i)=>(x+values[i])%divisor===0&&((x>threshold)!==(values[i]>threshold))).length;
    }else{
      const base=g?Number(body.match(/основанием (\d+)/)[1]):8,digits=g?Number(body.match(/ровно (\d+) цифры/)[1]):4,remainder=g?Number(body.match(/цифрой (\d+)/)[1]):5;
      oracle=values=>values.filter(x=>x>=base**(digits-1)&&x<base**digits&&x%base===remainder).length;
    }
    for(const r of result.testResults){const zero=r.input.indexOf(0);assert.ok(zero>=0);const values=r.input.slice(0,zero);assert.ok(values.every(x=>Number.isInteger(x)&&x>0));assert.equal(r.expected,oracle(values),t.bankId+':'+r.id);}
    assert.ok(result.testResults.some(r=>r.input.indexOf(0)===1000));assert.ok(result.testResults.some(r=>r.input[0]===0&&r.input.length>1));assert.equal(G.grade16('print(0)',{grading:g,filename:'answer.py'}).points,0);
    const record=byId.get(t.bankId);record.limitations.push('Python is parsed by a bounded school-language interpreter; unsupported syntax is not evidence of an incorrect algorithm.');if(!g)record.limitations.push('For the original FIPI task, only three official tests determine points; additional boundary tests are diagnostic.');return {tests:result.testResults.length,maximumSequence:1000};
  });
});

after(()=>{
  const report=[...byId.values()];for(const row of report)row.status=row.issues.length?'fail':row.checks.length>=2?'pass':'incomplete';
  const output=path.resolve(__dirname,'../output');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'oge-audit-practical.json'),JSON.stringify(report,null,2)+'\n');
});
