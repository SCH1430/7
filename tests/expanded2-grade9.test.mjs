import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {TEMPLATE_CATALOG,generateQuestions} from '../js/bank.js';
const rows=TEMPLATE_CATALOG.filter(q=>q.grade===9&&q.id.includes('-plus-'));
const extract=(s,re)=>{const m=s.match(re);assert.ok(m,'Cannot parse '+re+' from '+s);return m.slice(1);};
const csv=s=>s.split(', ').map(Number),list=(p,re)=>csv(extract(p,re)[0]),add=a=>a.reduce((s,x)=>s+x,0);
const column=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
const shortestBrute=(p,start,end,blocked='')=>{
 const edges=[...p.matchAll(/([A-Z])–([A-Z])(?: = (\d+))?/g)].map(m=>[m[1],m[2],m[3]?Number(m[3]):1]);let best=Infinity;
 function visit(node,seen,cost){if(node===end){best=Math.min(best,cost);return;}for(const[a,b,w]of edges){const v=a===node?b:b===node?a:null;if(v&&v!==blocked&&!seen.has(v))visit(v,new Set([...seen,v]),cost+w);}}visit(start,new Set([start]),0);return best;
};
const tables={
 'blank-cells':p=>extract(p,/Ячейки сверху вниз: (.+?)\./)[0].split(', ').filter(v=>v==='пусто').length,
 'counta':p=>extract(p,/Содержимое ячеек: (.+?)\./)[0].split(', ').filter(v=>v!=='пусто').length,
 'round-integer':p=>{const[a,b]=extract(p,/значение (\d+)\.(\d+)/).map(Number);return Math.floor((10*a+b+5)/10);},
 'mod-formula':p=>{let[a,b]=extract(p,/A1 = (\d+), B1 = (\d+)/).map(Number);while(a>=b)a-=b;return a;},
 'integer-parts':p=>{let[a,b]=extract(p,/A1 = (\d+), B1 = (\d+)/).map(Number),count=0;while(a>=b){count++;a-=b;}return count;},
 'text-length':p=>Array.from(extract(p,/текст «(.*?)»/)[0]).length,
 'sum-ignores-text':p=>add([...p.matchAll(/— число (-?\d+)/g)].map(m=>Number(m[1]))),
 'between-bounds':p=>{const a=list(p,/Значения: (.+?)\./),[l,h]=extract(p,/от (-?\d+) до (-?\d+) включительно/).map(Number);return a.reduce((s,x)=>s+Number(!(x<l||x>h)),0);},
 'absolute-changes':p=>{const a=list(p,/До изменения: (.+?)\./),b=list(p,/После изменения по тем же строкам: (.+?)\./);return add(a.map((x,i)=>Math.max(x,b[i])-Math.min(x,b[i])));},
 'category-sum':p=>{const a=extract(p,/Категории по строкам: (.+?)\./)[0].split(', '),b=list(p,/Баллы по тем же строкам: (.+?)\./),[c]=extract(p,/баллов категории ([ABC])/);let s=0;for(let i=0;i<a.length;i++)if(a[i]===c)s+=b[i];return s;},
 'rank-ties':p=>{const a=list(p,/Результаты: (.+?)\./),i=Number(extract(p,/позиции (\d+)/)[0])-1;return [...a].sort((x,y)=>y-x).indexOf(a[i])+1;},
 'median-seven':p=>{const a=list(p,/Данные: (.+?)\./);for(let i=0;i<4;i++){const x=Math.min(...a);a.splice(a.indexOf(x),1);if(i===3)return x;}},
 'weighted-mean':p=>{const[x,w,y,v]=extract(p,/Первое значение (\d+) имеет вес (\d+), второе (\d+) — вес (\d+)/).map(Number),a=Array(w).fill(x).concat(Array(v).fill(y));return add(a)/a.length;},
 'copy-up-left':p=>{const[row,dx,dy]=extract(p,/=\$D(\d+)\+F\$2 копируется на (\d+) столбца влево и на (\d+) строки вверх/).map(Number);return '=$D'+(row-dy)+'+'+column(6-dx)+'$2';},
 'column-aa':p=>{const[row,dx]=extract(p,/=Z(\d+)\+\$A\$1 копируют на (\d+) столбца/).map(Number);return '='+column(26+dx)+row+'+$A$1';},
 'nested-if':p=>{const x=Number(extract(p,/A1 = (\d+)/)[0]),[a,b,c,d,e]=extract(p,/ЕСЛИ\(A1<(\d+);(\d+);ЕСЛИ\(A1<(\d+);(\d+);(\d+)\)\)/).map(Number);for(const[limit,result]of[[a,b],[c,d],[Infinity,e]])if(x<limit)return result;},
 'missing-average':p=>{let answer=Number(extract(p,/равно (\d+)\/5/)[0]);for(const x of list(p,/четыре: (.+?)\./))answer-=x;return answer;},
 'replace-average':p=>{const[count,mean,old,fresh]=extract(p,/Среднее (\d+) ячеек равно (\d+)\. Ячейку со значением (\d+) заменили на (\d+)/).map(Number);return(count*mean-old+fresh)/count;},
 'group-difference':p=>{const cats=extract(p,/Группы: (.+?)\./)[0].split(', '),a=list(p,/Значения по тем же строкам: (.+?)\./);return add(a.map((x,i)=>cats[i]==='A'?x:-x));},
 'rolling-average':p=>{const a=list(p,/По порядку записаны: (.+?)\./);let best=-Infinity;for(let i=0;i+2<a.length;i++){let s=0;for(let j=i;j<i+3;j++)s+=a[j];best=Math.max(best,s/3);}return best;},
};
const networks={
 'degree-sum':p=>add(list(p,/узлов: (.+?)\./))/2,
 'ring-hops':p=>{const n=Number(extract(p,/Узлы 1–(\d+)/)[0]),dest=Number(extract(p,/из 1 в (\d+)/)[0]),dist=Array(n).fill(Infinity),q=[0];dist[0]=0;for(const u of q)for(const v of[(u+1)%n,(u+n-1)%n])if(dist[v]===Infinity){dist[v]=dist[u]+1;q.push(v);}return dist[dest-1];},
 'isolated-groups':p=>extract(p,/размерами (.+?)\./)[0].split(', ').length+Number(extract(p,/Ещё (\d+) узлов/)[0]),
 'url-fragment':p=>new URL(extract(p,/(https:\/\/\S+) фрагментом/)[0]).hash.slice(1),
 'root-relative-url':p=>{const[base]=extract(p,/Открыта (https:\/\/\S+)\./),[path]=extract(p,/Ссылка (\S+) начинается/);return new URL(path,base).href;},
 'host-number':p=>{const[a,b]=extract(p,/адрес 10\.20\.(\d+)\.(\d+)/).map(Number);return parseInt(a.toString(2).padStart(8,'0')+b.toString(2).padStart(8,'0'),2);},
 'binary-octet':p=>parseInt(extract(p,/виде: ([01]{8})/)[0],2),
 'usable-addresses':p=>{const b=Number(extract(p,/выделено (\d+) бит/)[0]);let count=0;for(let i=0;i<2**b;i++){const s=i.toString(2).padStart(b,'0');if(s.includes('0')&&s.includes('1'))count++;}return count;},
 'subnet-half':p=>{const d=Number(extract(p,/образца 192\.0\.\d+\.(\d+)/)[0]),a=list(p,/октетом: (.+?)\./);return a.filter(x=>(x&128)===(d&128)).length;},
 'bottleneck':p=>{const a=extract(p,/маршрута: (.+?) Мбит/)[0].split(', ').map(Number);let v=a[0];for(const x of a)if(x<v)v=x;return v;},
 'request-response':p=>{const[a,v,b,d]=extract(p,/запрос (\d+) байт со скоростью (\d+) байт\/с, затем сервер отправляет ответ (\d+) байт.*добавляет (\d+) с/).map(Number);return(a+b)/v+2*d;},
 'resend-once':p=>{const[n,size,k]=extract(p,/Отправлено (\d+) пакетов по (\d+) байт каждый\. Из них (\d+) пакета/).map(Number);return n*size+k*size;},
 'tree-broadcast':p=>{const[n,size]=extract(p,/из (\d+) узлов.*размером (\d+) байт/).map(Number);let bytes=0;for(let i=1;i<n;i++)bytes+=size;return bytes;},
 'broken-chain':p=>{const n=Number(extract(p,/Узлы 1–(\d+)/)[0]),k=Number(extract(p,/Удалили (\d+)/)[0]);return n-((n-1)-k);},
 'shortest-hops':p=>shortestBrute(p,'A',extract(p,/из A в ([A-Z])/)[0]),
 'avoid-node':p=>shortestBrute(p,'A','D',extract(p,/Узел ([A-Z]) закрыт/)[0]),
 'layered-routes':p=>{const[a,b,c]=extract(p,/слоя: (\d+), (\d+) и (\d+) узла/).map(Number);let count=0;for(let i=0;i<a;i++)for(let j=0;j<b;j++)for(let k=0;k<c;k++)count++;return count;},
 'packet-pipeline':p=>{const[links,packets,time]=extract(p,/из (\d+) одинаковых каналов передают (\d+) одинаковых пакетов.*длится (\d+) с/).map(Number),end=Array.from({length:packets},()=>Array(links).fill(0));for(let i=0;i<packets;i++)for(let j=0;j<links;j++)end[i][j]=Math.max(i?end[i-1][j]:0,j?end[i][j-1]:0)+time;return end.at(-1).at(-1);},
 'split-channels':p=>{const[size,v,w]=extract(p,/Файл (\d+) байт.*каналам (\d+) и (\d+) байт/).map(Number);let best=Infinity;for(let a=0;a<=size;a++)best=Math.min(best,Math.max(a/v,(size-a)/w));return best;},
 'subnet-quarter':p=>{const[c,d]=extract(p,/IPv4-адрес 192\.0\.(\d+)\.(\d+)/).map(Number);return '192.0.'+c+'.'+(d&192);},
};
const inputNums=s=>s.trim().split(/\s+/).map(Number);
const programOracle={
 'sign':s=>Number(s)<0?-1:Number(s)>0?1:0,
 'ceil-packs':s=>{const[n,k]=inputNums(s);let boxes=0;while(boxes*k<n)boxes++;return boxes;},
 'clock-after':s=>{let[h,m,d]=inputNums(s);for(let i=0;i<d;i++){m++;if(m===60){m=0;h++;}if(h===24)h=0;}return h+' '+m;},
 'median-three':s=>{const a=inputNums(s);return add(a)-Math.min(...a)-Math.max(...a);},
 'clamp':s=>{const[x,l,h]=inputNums(s);return x<l?l:x>h?h:x;},
 'cyclic-position':s=>{let[n,p,k]=inputNums(s);for(let i=0;i<k;i++){p++;if(p>n)p=1;}return p;},
 'positive-three':s=>{let count=0;for(const x of inputNums(s))if(x>0)count++;return count;},
 'first-maximum':s=>{const a=inputNums(s);let best=-Infinity,index=-1;for(let i=a.length-1;i>=0;i--)if(a[i]>=best){best=a[i];index=i;}return index;},
 'collapse-neighbours':s=>{const a=inputNums(s),out=[];for(let i=0;i<a.length;){out.push(a[i]);let j=i+1;while(j<a.length&&a[j]===a[i])j++;i=j;}return out.join(' ');},
 'normalise-spaces':s=>{const out=[];let word='';for(const c of s+' '){if(c===' '){if(word)out.push(word);word='';}else word+=c;}return out.join(' ');},
 'reverse-number':s=>{let n=Number(s),out=0;while(n){out=out*10+n%10;n=Math.floor(n/10);}return out;},
 'absolute-sort':s=>inputNums(s).map((x,i)=>[x,i]).sort((a,b)=>Math.abs(a[0])-Math.abs(b[0])||a[1]-b[1]).map(x=>x[0]).join(' '),
 'sign-changes':s=>{const a=inputNums(s);let count=0;for(let i=1;i<a.length;i++)if((a[i]<0&&a[i-1]>0)||(a[i]>0&&a[i-1]<0))count++;return count;},
 'unique-once':s=>{const counts=new Map();for(const x of inputNums(s))counts.set(x,(counts.get(x)||0)+1);return [...counts.values()].filter(x=>x===1).length;},
 'increasing-run':s=>{const a=inputNums(s);let best=1;for(let start=0;start<a.length;start++){let len=1;for(let j=start+1;j<a.length&&a[j]>a[j-1];j++)len++;best=Math.max(best,len);}return best;},
 'parentheses':s=>{const stack=[];for(const c of s){if(c==='(')stack.push(c);else if(!stack.length)return 0;else stack.pop();}return Number(stack.length===0);},
 'window-maximum':s=>{const[kText,line]=s.split('\n'),k=Number(kText),a=inputNums(line),prefix=[0];for(const x of a)prefix.push(prefix.at(-1)+x);return Math.max(...a.slice(k-1).map((_,i)=>prefix[i+k]-prefix[i]));},
 'rotate-right':s=>{const[kText,line]=s.split('\n'),k=Number(kText),a=inputNums(line),out=Array(a.length);for(let i=0;i<a.length;i++)out[(i+k)%a.length]=a[i];return out.join(' ');},
 'mode-smallest':s=>{const counts=new Map();for(const x of inputNums(s))counts.set(x,(counts.get(x)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];},
 'merge-sorted':s=>s.split('\n').flatMap(inputNums).sort((a,b)=>a-b).join(' '),
};
test('grade9 second expansion: 80 types, balanced levels, varying conditions and worked steps',()=>{
 assert.equal(rows.length,80);assert.equal(new Set(rows.map(x=>x.id)).size,80);
 for(const topic of ['python','programming','tables','networks']){const selected=rows.filter(x=>x.topicId==='g9-'+topic);assert.equal(selected.length,20);assert.deepEqual(['basic','standard','advanced'].map(d=>selected.filter(x=>x.difficulty===d).length),[7,7,6]);}
 for(const row of rows){const signatures=new Set();for(let seed=1;seed<=24;seed++){const q=generateQuestions({grade:9,templateIds:[row.id],seed:1430+seed,variant:seed%30+1})[0];assert.ok(q.solutionSteps.length>=2,row.id);assert.ok(new Set(q.solutionSteps).size>=2,row.id);assert.ok(q.solutionSteps.every(s=>s.length>10),row.id);assert.ok(q.prompt&&q.answer!==undefined);assert.doesNotMatch(q.explanation,/undefined|NaN/);if(q.kind==='program'){assert.ok(q.tests.length>=3);assert.doesNotMatch(q.answer,/\bimport\b/);}signatures.add(JSON.stringify([q.prompt,q.code]));}assert.ok(signatures.size>=2,'unchanging '+row.id);}
});
test('grade9 tables and networks: 960 answers independently recomputed from conditions',()=>{
 let checks=0;for(const row of rows.filter(x=>['g9-tables','g9-networks'].includes(x.topicId))){const solve=(row.topicId==='g9-tables'?tables:networks)[row.id.split('-plus-')[1]];assert.equal(typeof solve,'function',row.id);for(let seed=1;seed<=24;seed++){const q=generateQuestions({grade:9,templateIds:[row.id],seed:seed*997,variant:seed%30+1})[0];assert.equal(String(solve(q.prompt)),String(q.answer),row.id+' seed '+seed);checks++;}}assert.equal(checks,960);
});
test('grade9 Python: independent input oracles and CPython execution for every new trace and program',()=>{
 const runs=[];let traces=0,programCases=0;
 for(const row of rows.filter(x=>['g9-python','g9-programming'].includes(x.topicId)))for(let seed=1;seed<=12;seed++){
  const q=generateQuestions({grade:9,templateIds:[row.id],seed:seed*503,variant:seed+1})[0];
  if(q.code){runs.push({id:row.id,code:q.code,input:'',expected:String(q.answer)});traces++;}
  else {const oracle=programOracle[row.id.split('-plus-')[1]];assert.equal(typeof oracle,'function',row.id);for(const example of q.tests){const input=example.input.replace(/\n$/,'');assert.equal(String(oracle(input)),example.output.trimEnd(),row.id+' input '+JSON.stringify(input));runs.push({id:row.id,code:q.answer,input:example.input,expected:example.output.trimEnd()});programCases++;}}
 }
 const python=['import sys,json,io,contextlib','rows=json.load(sys.stdin)','results=[]','for row in rows:','    old=sys.stdin','    sys.stdin=io.StringIO(row["input"])','    output=io.StringIO()','    try:','        with contextlib.redirect_stdout(output):','            exec(row["code"],{})','        results.append({"output":output.getvalue().rstrip("\\n")})','    except Exception as e:','        results.append({"error":str(e),"id":row["id"]})','    finally:','        sys.stdin=old','json.dump(results,sys.stdout,ensure_ascii=False)'].join('\n');
 const p=spawnPythonSync(['-c',python],{input:JSON.stringify(runs),encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(p.status,0,p.stderr);const result=JSON.parse(p.stdout);assert.equal(result.length,runs.length);
 for(let i=0;i<runs.length;i++){assert.equal(result[i].error,undefined,runs[i].id+': '+result[i].error);assert.equal(result[i].output,runs[i].expected,runs[i].id);}assert.equal(traces,240);assert.ok(programCases>=1000);console.log(JSON.stringify({grade9NewTypes:80,independentNumericTextCases:960,traceExecutions:traces,independentProgramCases:programCases}));
});

