import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {registerGrade11} from '../js/bank-grade11.js';

const entries=[];
registerGrade11({
  add:(topic,key,title,difficulty,difficultyReason,build)=>entries.push({topic,key,title,difficulty,difficultyReason,build}),
  numeric:(prompt,answer,explanation)=>({kind:'number',prompt,answer:String(answer),explanation,points:1}),
  codeOutput:(code,answer,explanation)=>({kind:'number',prompt:'Какое число выведет программа Python?',code,answer:String(answer),explanation,points:1}),
  program:(prompt,answer,tests)=>({kind:'program',prompt,answer,tests,points:3})
});
function random(seed){let s=seed>>>0;const f=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};f.int=(a,b)=>a+Math.floor(f()*(b-a+1));f.pick=a=>a[f.int(0,a.length-1)];f.array=(n,a,b)=>Array.from({length:n},()=>f.int(a,b));return f;}
const sum=a=>a.reduce((s,x)=>s+x,0);
const numbers=s=>[...s.matchAll(/-?\d+/g)].map(x=>Number(x[0]));
const list=s=>s.split(', ').map(Number);
function gridPaths(w,h,via=null,blocked=null){
  function walk(x,y,visited){if(blocked&&x===blocked[0]&&y===blocked[1])return 0;visited||=Boolean(via&&x===via[0]&&y===via[1]);if(x===w&&y===h)return !via||visited?1:0;return(x<w?walk(x+1,y,visited):0)+(y<h?walk(x,y+1,visited):0);}
  return walk(0,0,false);
}
function expectedGraph(key,p){
  const n=numbers(p);
  switch(key){
    case 'ext-tree-edges': return n[0]-1;
    case 'ext-forest-components': {let components=n[0];for(let i=0;i<n[1];i++)components--;return components;}
    case 'ext-bipartite-degree': return n[1];
    case 'ext-outdegree-sum': return sum(list(p.match(/равны (.*?)\./)[1]));
    case 'ext-star-distance': return n[0]+n[1];
    case 'ext-complement': {let pairs=0;for(let a=0;a<n[0];a++)for(let b=a+1;b<n[0];b++)pairs++;return pairs-n[1];}
    case 'ext-triangle-detour': return Math.min(n[0]+n[1],n[2]);
    case 'ext-diamond-paths': {let count=1;for(let a=0;a<n[0];a++)for(let b=0;b<n[1];b++)count++;return count;}
    case 'ext-grid-through': {const m=[...p.matchAll(/\((\d+); (\d+)\)/g)].map(x=>x.slice(1).map(Number));return gridPaths(...m[1],m[2]);}
    case 'ext-two-step-walks': return sum(numbers(p.match(/Из A.*?Других/s)[0]));
    case 'ext-grid-blocked': {const m=[...p.matchAll(/\((\d+); (\d+)\)/g)].map(x=>x.slice(1).map(Number));return gridPaths(...m[1],null,m[2]);}
    case 'ext-avoid-number': {const end=Number(p.match(/от 0 до (\d+)/)[1]),b=Number(p.match(/Вершина (\d+) запрещена/)[1]);const walk=x=>x===b||x>end?0:x===end?1:walk(x+1)+walk(x+2);return walk(0);}
    case 'ext-spanning-cycle': {const weights=list(p.match(/рёбер: (.*?)\./)[1]);return Math.min(...weights.map((_,i)=>sum(weights.filter((_,j)=>j!==i))));}
    case 'ext-matching': {const size=Number(p.match(/по (\d+) пронумерованных/)[1]);const count=remaining=>!remaining.length?1:sum(remaining.map((_,i)=>count(remaining.filter((_,j)=>i!==j))));return count(Array.from({length:size},(_,i)=>i));}
    case 'ext-mandatory-route': {const [a,b,c,d]=numbers(p.match(/рёбра (.*?)\. Все/)[1]);return Math.min(a+b+d,c+d);}
    default: throw Error(key);
  }
}
function expectedData(key,p){
  switch(key){
    case 'ext-binary-search-steps': {const [,nn,tt]=p.match(/от 1 до (\d+) ищут число (\d+)/),target=Number(tt);let a=Array.from({length:Number(nn)},(_,i)=>i+1),k=0;while(a.length){let mid=Math.floor((a.length-1)/2);k++;if(a[mid]===target)return k;a=a[mid]<target?a.slice(mid+1):a.slice(0,mid);}throw Error('Target not found');}
    case 'ext-median': {const a=list(p.match(/значений: (.*?)\./)[1]);return a.find(x=>a.filter(y=>y<x).length<=3&&a.filter(y=>y>x).length<=3);}
    case 'ext-record-rounding': {const [,bits,count]=p.match(/содержит (\d+) полезных бит.*всего их (\d+)/);let bytes=0;while(bytes*8<Number(bits))bytes++;return bytes*Number(count);}
    case 'ext-index-capacity': {const [bits,reserve]=numbers(p);return Array.from({length:2**bits},(_,i)=>i).slice(reserve).length;}
    case 'ext-run-length': return p.match(/Строку ([ABC]+) кодируют/)[1].match(/A+|B+|C+/g).length*2;
    case 'ext-join-count': {const a=list(p.match(/A содержит ключи: (.*?)\./)[1]),b=list(p.match(/B содержит ключи: (.*?)\./)[1]);let count=0;for(const x of a)for(const y of b)if(x===y)count++;return count;}
    case 'ext-subnet-number': {const [,octet,prefix]=p.match(/192\.168\.10\.(\d+), префикс \/(\d+)/);return Number(octet)&(255<<(32-Number(prefix)));}
    case 'ext-packet-overhead': {const [,size,payload,header]=p.match(/Передают (\d+) байт.*более (\d+) байт.*заголовок (\d+) байт/);let left=Number(size),total=0;while(left>0){const sent=Math.min(left,Number(payload));total+=sent+Number(header);left-=sent;}return total;}
    case 'ext-window-sum': {const a=list(p.match(/значения: (.*?)\./)[1]),k=Number(p.match(/сумму (\d+) соседних/)[1]);let best=-Infinity;for(let i=0;i+k<=a.length;i++){let total=0;for(let j=0;j<k;j++)total+=a[i+j];best=Math.max(best,total);}return best;}
    case 'ext-permissions': {const [,a,b]=p.match(/масками ([01]{8}) и ([01]{8})/);return [...a].filter((c,i)=>c==='1'&&b[i]==='1').length;}
    case 'ext-sum-remainder-pairs': {const a=list(p.match(/Последовательность: (.*?)\./)[1]),k=Number(p.match(/кратную (\d+)/)[1]);const counts=Array(k).fill(0);let ans=0;for(const x of a){ans+=counts[(k-x%k)%k];counts[x%k]++;}return ans;}
    case 'ext-equal-distance': {const a=list(p.match(/Последовательность: (.*?)\./)[1]);let answer=0;for(const x of new Set(a))answer=Math.max(answer,a.lastIndexOf(x)-a.indexOf(x));return answer;}
    case 'ext-interval-schedule': {const a=[...p.matchAll(/\[(\d+);(\d+)\)/g)].map(m=>m.slice(1).map(Number));let best=0;for(let mask=0;mask<2**a.length;mask++){const subset=a.filter((_,i)=>mask&(1<<i));if(subset.every((v,i)=>subset.every((w,j)=>i===j||v[1]<=w[0]||w[1]<=v[0])))best=Math.max(best,subset.length);}return best;}
    case 'ext-subset-capacity': {const a=list(p.match(/размером (.*?) Мбайт/)[1]),cap=Number(p.match(/Свободно (\d+) Мбайт/)[1]);let reachable=new Set([0]);for(const x of a)reachable=new Set([...reachable,...[...reachable].map(s=>s+x).filter(s=>s<=cap)]);return Math.max(...reachable);}
    case 'ext-range-query-sum': {const a=list(p.match(/Массив: (.*?)\./)[1]);const [,l1,r1,l2,r2]=p.match(/позиции с (\d+) по (\d+).*второй — с (\d+) по (\d+)/).map(Number);let total=0;for(let i=l1;i<=r1;i++)total+=a[i-1];for(let i=l2;i<=r2;i++)total+=a[i-1];return total;}
    default: throw Error(key);
  }
}

test('grade11 adds sixty distinct balanced templates with independently verified graph and data answers',()=>{
  assert.equal(entries.length,60);assert.equal(new Set(entries.map(e=>e.topic+'-'+e.key)).size,60);
  for(const topic of ['algorithms','programming','graphs','data'])for(const level of ['basic','standard','advanced'])assert.equal(entries.filter(e=>e.topic===`g11-${topic}`&&e.difficulty===level).length,5);
  for(const seed of [1,19,1430,2026,81021,42,123456,987654])for(const e of entries){
    const q=e.build(random(seed));assert.ok(q.prompt);assert.ok(q.answer!==undefined);assert.ok(q.solutionSteps.length>=2);assert.equal(new Set(q.solutionSteps).size,q.solutionSteps.length);
    for(const s of q.solutionSteps)assert.ok(s.length>=10,e.key);
    if(e.topic==='g11-graphs')assert.equal(Number(q.answer),expectedGraph(e.key,q.prompt),`${e.key} seed${seed}`);
    if(e.topic==='g11-data')assert.equal(Number(q.answer),expectedData(e.key,q.prompt),`${e.key} seed${seed}`);
  }
});

test('grade11 analysis code and all program reference solutions execute and agree with independent oracles',()=>{
  const cases=[];
  for(const seed of [1,19,1430,2026,81021,42,123456,987654])for(const e of entries){
    const q=e.build(random(seed));
    if(q.code)cases.push({key:e.key,code:q.code,cases:[{input:'',output:q.answer}],prompt:q.prompt});
    if(q.kind==='program'){assert.ok(q.tests.length>=6);assert.match(q.prompt,/200 элементов|1000 символов|100 цифр|1000000000/);const boundary=q.tests.at(-1).input.trim();if(q.prompt.startsWith('В одной строке'))assert.equal(boundary.split(/\s+/).length,200);else if(q.prompt.includes('круглых скобок'))assert.equal(boundary.length,1000);else if(q.prompt.includes('ненулевых десятичных цифр'))assert.equal(boundary.length,100);else assert.equal(boundary,'1000000000');assert.ok(!/^\s*(?:from|import)\s/m.test(q.answer));cases.push({key:e.key,code:q.answer,cases:q.tests,prompt:q.prompt});}
  }
  const script=String.raw`import sys,json,io,contextlib,itertools,math,re
items=json.load(sys.stdin)
count=0
def reference(key,s,p):
    if key=='ext-balanced-parentheses':
        while '()' in s:s=s.replace('()','')
        return int(not s.strip())
    if key=='ext-digit-product':return math.prod(int(c) for c in s.strip() if c!='0')
    if key=='ext-base-zero-count':
        b=int(re.search(r'основанием (\d+)',p)[1]);n=int(s)
        if not n:return 1
        digits=[]
        while n:digits.append(n%b);n//=b
        return digits.count(0)
    a=list(map(int,s.split()))
    if key=='ext-positive-product':return math.prod(x for x in a if x>0)
    if key=='ext-minimum-count':return a.count(min(a))
    if key=='ext-last-positive':return max([0]+[i+1 for i,x in enumerate(a) if x>0])
    if key=='ext-zero-runs':return sum(value==0 for value,group in itertools.groupby(a))
    if key=='ext-increasing-run':return max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[k]<a[k+1] for k in range(i,j-1)))
    if key=='ext-gcd-list':return math.gcd(*a)
    if key=='ext-distinct-count':return len(set(a))
    if key=='ext-nearest-zero':return min(a,key=lambda x:(abs(x),x))
    if key=='ext-subarray-sum':return max(sum(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1))
    if key=='ext-pair-divisible':
        k=int(re.search(r'делится на (\d+)',p)[1]);return sum((x+y)%k==0 for x,y in itertools.combinations(a,2))
    if key=='ext-balanced-binary-fragment':return max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if a[i:j].count(0)==a[i:j].count(1)])
    if key=='ext-second-distinct':return sorted(set(a))[-2]
    return None
for item in items:
    for case in item['cases']:
        old=sys.stdin;sys.stdin=io.StringIO(case['input']);out=io.StringIO()
        try:
            with contextlib.redirect_stdout(out):exec(compile(item['code'],item['key'],'exec'),{})
        finally:sys.stdin=old
        actual=out.getvalue().strip()
        assert actual==case['output'].strip(),(item['key'],case,actual)
        if item['key'] in ['ext-positive-product','ext-minimum-count','ext-last-positive','ext-zero-runs','ext-digit-product','ext-increasing-run','ext-gcd-list','ext-distinct-count','ext-nearest-zero','ext-base-zero-count','ext-subarray-sum','ext-pair-divisible','ext-balanced-binary-fragment','ext-balanced-parentheses','ext-second-distinct']:
            oracle=reference(item['key'],case['input'],item['prompt'])
            assert actual==str(oracle),(item['key'],case,oracle,actual)
        count+=1
print(count)
`;
  const out=spawnPythonSync(['-c',script],{input:JSON.stringify(cases),encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(out.status,0,out.stderr);assert.ok(Number(out.stdout)>800);console.log(`Grade 11: ${out.stdout.trim()} executed Python cases; 240 independent graph/data checks.`);
});
