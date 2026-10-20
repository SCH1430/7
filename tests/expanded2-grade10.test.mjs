import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {TEMPLATE_CATALOG,generateQuestions,checkAnswer} from '../js/bank.js';

const rows=TEMPLATE_CATALOG.filter(q=>q.grade===10&&q.id.includes('-plus-'));
const sum=a=>a.reduce((s,x)=>s+x,0),range=(a,b)=>Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i);
const nums=p=>(p.replace(/−/g,'-').match(/-?\d+/g)||[]).map(Number);
const groups=(p,re)=>{const m=p.match(re);assert.ok(m,`${re}: ${p}`);return m.slice(1);};
const digits=(p,re)=>groups(p,re).map(Number);
const sets=p=>groups(p,/A = \{([^}]+)\}, B = \{([^}]+)\}/).map(nums);
const words=p=>groups(p,/A = ([01]+)[\s\S]*B = ([01]+)/);
const dataRows=p=>p.split('\n').filter(x=>x.includes(' | ')).slice(1).map(x=>x.split(' | '));
const countMasks=(n,predicate)=>{let count=0;for(let mask=0;mask<2**n;mask++)if(predicate(mask))count++;return count;};
const weight=n=>n.toString(2).replace(/0/g,'').length;
const combinations=(n,k)=>{let row=[1];for(let i=0;i<n;i++){const next=[1];for(let j=1;j<=i;j++)next.push((row[j-1]||0)+(row[j]||0));next.push(1);row=next;}return row[k]||0;};
const sols={
 'nand-vector':p=>{const[a,b]=words(p);let zero=0;for(let i=0;i<a.length;i++)if(a[i]==='1'&&b[i]==='1')zero++;return zero;},
 'finite-intersection':p=>{const[a,b]=sets(p);return new Set(a.filter(x=>new Set(b).has(x))).size;},
 'proper-subsets':p=>{const[n]=nums(p);return countMasks(n,m=>m!==0&&m!==2**n-1);},
 'cartesian-triples':p=>{const[a,b,c]=nums(p);let count=0;for(let x=0;x<a;x++)for(let y=0;y<b;y++)for(let z=0;z<c;z++)count++;return count;},
 'threshold-flags':p=>{const[a]=groups(p,/входах: ([01, ]+)\./),[k]=digits(p,/не меньше (\d+)/);return Number(nums(a).filter(x=>x===1).length>=k);},
 'outside-closed':p=>{const[n,a,b]=digits(p,/от 1 до (\d+)[\s\S]*условие (\d+) ≤ x ≤ (\d+)/);return range(1,n).filter(x=>!(a<=x&&x<=b)).length;},
 'missing-union':p=>{const[a,b,u]=nums(p);let possible=[];for(let inter=0;inter<=Math.min(a,b);inter++)if(a+b-inter===u)possible.push(inter);assert.equal(possible.length,1);return possible[0];},
 'hamming-xor':p=>{const[a,b]=words(p);return weight(parseInt(a,2)^parseInt(b,2));},
 'equivalence-independent':p=>{const[n]=nums(p);return countMasks(n,m=>(m&1)===(m>>1&1)&&(m>>2&1)===(m>>3&1));},
 'exact-weight':p=>{const[n,k]=nums(p);return countMasks(n,m=>weight(m)===k);},
 'even-parity':p=>{const[n]=nums(p);return countMasks(n,m=>weight(m)%2===0);},
 'squared-image':p=>{const[a,b]=nums(p);const s=new Set();for(let x=a;x<=b;x++)s.add(x*x);return s.size;},
 'set-implication':p=>{const[a,,b,c,,d]=nums(p);return range(Math.min(a,c)-1,Math.max(b,d)+1).filter(x=>x>=a&&x<=b&&!(x>=c&&x<=d)).length;},
 'modular-xor':p=>{const[,n,a,b]=nums(p);return range(1,n).filter(x=>Number(x%a===0)+Number(x%b===0)===1).length;},
 'cycle-implications':p=>{const[n]=digits(p,/Для (\d+) переменных/),[free]=digits(p,/Ещё (\d+) переменных/);return countMasks(n+free,m=>range(0,n-1).every(i=>!(m>>i&1)||(m>>((i+1)%n)&1)));},
 'one-of-three-sets':p=>{const[a,b,c,ab,ac,bc,abc]=nums(p);const regions=[a-ab-ac+abc,b-ab-bc+abc,c-ac-bc+abc,ab-abc,ac-abc,bc-abc,abc];assert.ok(regions.every(x=>x>=0));const people=regions.flatMap((count,index)=>Array(count).fill([1,1,1,2,2,2,3][index]));return people.filter(x=>x===1).length;},
 'no-neighbor-ones':p=>{const[n]=nums(p);return countMasks(n,m=>!(m.toString(2).includes('11')));},
 'cross-implications':p=>{const[a,b]=digits(p,/Есть (\d+) логических переменных группы A и (\d+) группы B/);return countMasks(a+b,m=>range(0,a-1).every(i=>range(a,a+b-1).every(j=>!(m>>i&1)||(m>>j&1))));},
 'positive-parameter':p=>{const[n,d]=digits(p,/от 1 до (\d+)[\s\S]*делится на (\d+)/);for(let a=0;a<=n;a++)if(range(1,n).every(x=>x<=a||x%d===0))return a;},
 'two-disjoint-ones':p=>{const[a,b]=nums(p);return countMasks(a+b,m=>weight(m%(2**a))===2&&weight(Math.floor(m/2**a))===2&&!m.toString(2).includes('11'));},
 'alpha-plane':p=>{const[w,h,b]=nums(p);let bytes=0;for(let y=0;y<h;y++)bytes+=w*b/8;return bytes;},
 'quantization-levels':p=>{const[levels]=nums(p);let bits=0,capacity=1;while(capacity<levels){bits++;capacity*=2;}return bits;},
 'video-frames':p=>{const[m,s,f]=nums(p);return sum(Array(m).fill(60*f))+sum(Array(s).fill(f));},
 'mixed-symbol-width':p=>{const[a,b,c]=digits(p,/(\d+) символов занимают по 1 байту, (\d+) символов — по 2 байта, (\d+) символов — по 4/);return sum([...Array(a).fill(1),...Array(b).fill(2),...Array(c).fill(4)]);},
 'checksum-block':p=>{const[count,bits]=nums(p);return sum(Array(count).fill(bits/8));},
 'header-share':p=>{const[all,header]=nums(p);return header/(all/100);},
 'packed-booleans':p=>{const[count]=nums(p);return sum(Array(count/8).fill(7));},
 'alignment-four':p=>{const[count,size]=nums(p);let allocated=size;while(allocated%4!==0)allocated++;return allocated*count;},
 'tile-borders':p=>{const[count,w,h,b]=nums(p);let pixels=0;for(let y=-b;y<h+b;y++)for(let x=-b;x<w+b;x++)pixels++;return pixels*count;},
 'limited-run':p=>{const[len,cap,record]=nums(p);let count=0;for(let left=len;left>0;left-=cap)count++;return count*record;},
 'duplicate-dictionary':p=>{const[all,unique,size,link]=nums(p);return sum(Array(unique).fill(size).concat(Array(all).fill(link)));},
 'trim-overlap':p=>{const[duration,rate,a,b,c,d]=nums(p);return range(0,duration-1).filter(sec=>!(sec>=a&&sec<b)&&!(sec>=c&&sec<d)).length*rate;},
 'packet-retries':p=>{const[count,payload,header,retries]=nums(p);return sum(Array(count+retries).fill(payload+header));},
 'separate-fields':p=>{const[a,b,c,count]=nums(p),rounded=x=>{let bytes=0;while(bytes*8<x)bytes++;return bytes;};return (sum([a,b,c].map(rounded))-rounded(a+b+c))*count;},
 'key-delta-frames':p=>{const[frames,,second,,period,full,delta]=nums(p);assert.equal(second,period+1);let size=0;for(let i=1;i<=frames;i++)size+=(i-1)%period===0?full:delta;return size;},
 'packet-pipeline':p=>{const[count,a,b]=nums(p);let freeA=0,freeB=0;for(let i=0;i<count;i++){freeA+=a;freeB=Math.max(freeA,freeB)+b;}return freeB;},
 'memory-seconds':p=>{const[capacity,head,rate,depth,channels]=nums(p);let seconds=0;while(head+(seconds+1)*rate*depth*channels/8<=capacity)seconds++;return seconds;},
 'four-for-three':p=>{const[bytes]=digits(p,/содержит (\d+) байт/);let output=0;for(let i=0;i<bytes;i+=3)output+=4;return output-bytes;},
 'prefix-capacity':p=>{const[a,b,len]=groups(p,/слова ([01]+) и ([01]+)[\s\S]*ровно (\d+)/);return countMasks(Number(len),m=>{const s=m.toString(2).padStart(Number(len),'0');return !s.startsWith(a)&&!s.startsWith(b)&&!a.startsWith(s)&&!b.startsWith(s);});},
 'resolution-scale':p=>{const[w,h,f,,depth,div]=nums(p);return (w*f)*(h*f)/(div*8)*depth;},
 'forest-components':p=>{const[n,m]=nums(p);const vertices=Array(n).fill(1);for(let i=0;i<m;i++)vertices.pop();return vertices.length;},
 'complement-edges':p=>{const[n,edges]=nums(p);let all=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)all++;return all-edges;},
 'median-odd':p=>{const a=nums(p);return a.sort((a,b)=>a-b)[Math.floor(a.length/2)];},
 'data-range':p=>{const a=nums(p);let best=0;for(const x of a)for(const y of a)best=Math.max(best,x-y);return best;},
 'frequency-mode':p=>{const rows=dataRows(p).map(r=>r.map(Number)),expanded=rows.flatMap(([v,n])=>Array(n).fill(v));return rows.map(([v])=>[v,expanded.filter(x=>x===v).length]).sort((a,b)=>b[1]-a[1])[0][0];},
 'ternary-leaves':p=>{const[count]=nums(p);let leaves=1;for(let i=0;i<count;i++){leaves--;leaves+=3;}return leaves;},
 'join-duplicates':p=>{const[a,b,c,d]=nums(p),left=[...Array(a).fill('X'),...Array(b).fill('Y')],right=[...Array(c).fill('X'),...Array(d).fill('Y')];let count=0;for(const x of left)for(const y of right)if(x===y)count++;return count;},
 'frequency-median':p=>{const values=dataRows(p).flatMap(([v,count])=>Array(Number(count)).fill(Number(v))).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];},
 'linear-calibration':p=>{const[x1,y1,x2,y2,x]=nums(p);return y2+(x-x2)*(y2-y1)/(x2-x1);},
 'cache-lru':p=>{const[cap]=digits(p,/вмещает (\d+) страницы/),[listed]=groups(p,/Запросы: ([\d, ]+)\./),requests=nums(listed),last=new Map();let misses=0;requests.forEach((x,i)=>{if(!last.has(x)){misses++;if(last.size===cap){const oldest=[...last.entries()].sort((a,b)=>a[1]-b[1])[0][0];last.delete(oldest);}}last.set(x,i);});return misses;},
 'triangle-network':p=>{const[a,b,c]=nums(p);return Math.min(a+b,a+c,b+c);},
 'ring-route':p=>{const[last]=digits(p,/от 0 до (\d+)/),[length]=digits(p,/длину (\d+)/),[a,b]=digits(p,/из (\d+) в (\d+)/);const n=last+1,dist=Array(n).fill(Infinity),queue=[a];dist[a]=0;for(const v of queue)for(const w of [(v+1)%n,(v+n-1)%n])if(dist[w]===Infinity){dist[w]=dist[v]+length;queue.push(w);}return dist[b];},
 'weighted-star':p=>{const a=nums(p);let best=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)best=Math.max(best,a[i]+a[j]);return best;},
 'batch-parallel':p=>{const a=nums(p);let time=0;for(let i=0;i<a.length;i+=2){let spent=0;while(spent<a[i]||spent<a[i+1])spent++;time+=spent;}return time;},
 'knapsack-small':p=>{const[cap]=digits(p,/вмещает (\d+) Мбайт/),items=dataRows(p).map(r=>r.map(Number)),dp=Array(cap+1).fill(0);for(const[,size,value]of items)for(let w=cap;w>=size;w--)dp[w]=Math.max(dp[w],dp[w-size]+value);return dp[cap];},
 'circular-order':p=>{const[n]=nums(p);let count=0;const permute=rest=>{if(!rest.length){count++;return;}for(let i=0;i<rest.length;i++)permute(rest.filter((_,j)=>i!==j));};permute(range(1,n-1));return count;},
 'team-both-groups':p=>{const[a,b,k]=nums(p);return countMasks(a+b,m=>weight(m)===k&&weight(m%(2**a))>0&&weight(Math.floor(m/2**a))>0);},
 'assignment-cost':p=>{const costs=dataRows(p).map(row=>row.slice(1).map(Number));let best=Infinity;const dfs=(i,used,total)=>{if(i===3){best=Math.min(best,total);return;}for(let j=0;j<3;j++)if(!used.includes(j))dfs(i+1,[...used,j],total+costs[i][j]);};dfs(0,[],0);return best;},
 'grid-forbidden':p=>{const points=[...p.matchAll(/\((\d+),(\d+)\)/g)].map(m=>[Number(m[1]),Number(m[2])]),[, [x,y],[u,v]]=points,dp=Array.from({length:y+1},()=>Array(x+1).fill(0));dp[0][0]=1;for(let j=0;j<=y;j++)for(let i=0;i<=x;i++){if(i===u&&j===v){dp[j][i]=0;continue;}if(i||j)dp[j][i]=(i?dp[j][i-1]:0)+(j?dp[j-1][i]:0);}return dp[y][x];},
 'weighted-choice-budget':p=>{const[a,b]=groups(p,/различных A: ([\d, ]+); пяти различных B: ([\d, ]+)\./),[budget]=digits(p,/Бюджет (\d+)/);const prices=nums(a).flatMap(x=>nums(b).map(y=>x+y));return prices.filter(x=>x<=budget).length;},
};
const programOracle=(key,input,p)=>{
 const a=nums(input);
 if(key==='program-equal-run'){const runs=[];for(const x of a){if(runs.length&&runs.at(-1)[0]===x)runs.at(-1)[1]++;else runs.push([x,1]);}return Math.max(...runs.map(x=>x[1]));}
 if(key==='program-max-subarray'){let best=-Infinity;for(let end=1;end<=a.length;end++){let s=0;for(let start=end-1;start>=0;start--){s+=a[start];best=Math.max(best,s);}}return best;}
 if(key==='program-distinct-window'){let left=0,best=0;const last=new Map();for(let right=0;right<a.length;right++){if(last.has(a[right]))left=Math.max(left,last.get(a[right])+1);last.set(a[right],right);best=Math.max(best,right-left+1);}return best;}
 if(key==='program-pairs-divisible'){const[k]=digits(p,/делится на (\d+)/);const freq=Array(k).fill(0);let count=0;for(const x of a){const residue=(x%k+k)%k;count+=freq[(k-residue)%k];freq[residue]++;}return count;}
 if(key==='program-merge'){const values=input.trim().split('\n').flatMap(line=>nums(line));return values.sort((a,b)=>a-b).join(' ');}
 if(key==='program-first-unique'){const duplicates=new Set();for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]===a[j])duplicates.add(a[i]);for(const x of a)if(!duplicates.has(x))return x;return 'NONE';}
 throw new Error('Missing program oracle '+key);
};

const pythonCases=[];
test('second grade 10 expansion has 80 distinct types, balanced levels, safe precise solutions and independent oracles',()=>{
 assert.equal(rows.length,80);assert.equal(new Set(rows.map(r=>r.title)).size,80);
 for(const topic of ['logic','encoding','algorithms','models']){const selected=rows.filter(r=>r.topicId===`g10-${topic}`);assert.equal(selected.length,20);assert.deepEqual(['basic','standard','advanced'].map(level=>selected.filter(r=>r.difficulty===level).length),[7,7,6]);}
 let numericChecks=0,programChecks=0,traceChecks=0;
 for(const row of rows){const seen=new Set();for(let seed=1;seed<=20;seed++){
  const q=generateQuestions({grade:10,templateIds:[row.id],seed:seed*317,variant:1+seed%30})[0],key=row.id.split('-plus-')[1];
  seen.add(JSON.stringify([q.prompt,q.code]));assert.ok(q.solutionSteps.length>=2);assert.ok(q.solutionSteps.every(s=>s.length>=10));assert.equal(new Set(q.solutionSteps).size,q.solutionSteps.length);
  if(q.kind==='program'){
    assert.ok(q.tests.length>=3);assert.ok(!/^\s*(?:import|from)\s/m.test(q.answer));
    for(const sample of q.tests){const expected=String(programOracle(key,sample.input,q.prompt));assert.equal(sample.output.trim(),expected,row.id);pythonCases.push({id:row.id,code:q.answer,input:sample.input,expected});programChecks++;}
  }else if(q.code){assert.ok(!/^\s*(?:import|from)\s/m.test(q.code));pythonCases.push({id:row.id,code:q.code,input:'',expected:String(q.answer)});traceChecks++;}
  else{assert.ok(sols[key],'oracle '+key);const expected=sols[key](q.prompt);assert.equal(String(q.answer),String(expected),row.id+'\n'+q.prompt);assert.equal(checkAnswer(q,String(expected)).correct,true);numericChecks++;}
  if(q.kind==='number'){assert.ok(Number.isSafeInteger(Number(q.answer)),row.id);}
 }
 assert.ok(seen.size>1,'real conditions must vary: '+row.id);
 }
 assert.equal(numericChecks,1200);assert.equal(traceChecks,280);assert.equal(programChecks,720);
});

test('all new grade 10 Python traces and program tests execute independently in CPython',()=>{
 assert.equal(pythonCases.length,1000);
 const driver=`import json,sys,io,contextlib,traceback\ncases=json.load(sys.stdin)\nfor case in cases:\n    old=sys.stdin\n    sys.stdin=io.StringIO(case['input'])\n    output=io.StringIO()\n    try:\n        with contextlib.redirect_stdout(output):\n            exec(compile(case['code'],case['id'],'exec'),{})\n    finally:\n        sys.stdin=old\n    actual=output.getvalue().strip()\n    if actual!=case['expected']:\n        raise AssertionError(str((case['id'],case['input'],case['expected'],actual)))\nprint(len(cases))\n`;
 const result=spawnPythonSync(['-c',driver],{input:JSON.stringify(pythonCases),encoding:'utf8',timeout:90000,maxBuffer:2000000});
 assert.equal(result.status,0,result.stderr||String(result.error));assert.equal(result.stdout.trim(),'1000');
});
