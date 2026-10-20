import {test} from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {registerMoreGrade8} from '../js/bank-more-grade8.js';
const entries=[];
registerMoreGrade8({
  add:(topic,key,title,difficulty,reason,build)=>entries.push({topic,key,title,difficulty,reason,build}),
  numeric:(prompt,answer,explanation,extra={})=>({kind:'number',prompt,answer:String(answer),explanation,points:1,...extra}),
  textual:(prompt,answer,explanation,extra={})=>({kind:'text',prompt,answer:String(answer),explanation,points:1,...extra}),
  codeOutput:(code,answer,explanation)=>({kind:'number',prompt:'Какое число выведет программа Python?',code,answer:String(answer),explanation,points:1}),
});
function random(seed,edge){let x=seed>>>0;const r=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};r.int=(a,b)=>edge==='min'?a:edge==='max'?b:a+Math.floor(r()*(b-a+1));r.pick=a=>a[r.int(0,a.length-1)];r.array=(n,a,b)=>Array.from({length:n},()=>r.int(a,b));return r;}
const numbers=s=>(s.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);
const nums=q=>numbers(q.prompt);
const range=(a,b)=>Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i);
const read=(p,regexp)=>{const m=p.match(regexp);assert.ok(m,`Cannot parse: ${p}`);return m.slice(1);};
const decode=(s,b)=>[...s].reduce((value,c)=>value*b+parseInt(c,36),0);
const bits=n=>{let power=1,k=0;while(power<n){power*=2;k++;}return k;};
const solve={
 'g8-bases':{
  'octal-frequency':q=>{const[s,d]=read(q.prompt,/записи (\d+) сколько.*цифра (\d)/);let n=0;for(const c of s)if(c===d)n++;return n;},
  'binary-successor':q=>{const[s]=read(q.prompt,/за ([01]+)₂/);let digits=[...s],carry=1;for(let i=digits.length-1;i>=0;i--){const v=Number(digits[i])+carry;digits[i]=String(v%2);carry=Math.floor(v/2);}return(carry?'1':'')+digits.join('');},
  'octal-binary-groups':q=>{const[s]=read(q.prompt,/число (\d+)₈/);return[...s].map(c=>['000','001','010','011','100','101','110','111'][Number(c)]).join('').replace(/^0+/,'');},
  'hex-byte':q=>{const[s]=read(q.prompt,/как ([0-9A-F]+) в/);const n=decode(s,16);return range(0,7).reverse().map(k=>Math.floor(n/2**k)%2).join('');},
  'minimum-base':q=>{const[s]=read(q.prompt,/запись (\d+)\./);return range(2,11).find(b=>[...s].every(c=>Number(c)<b));},
  'leading-zeros':q=>decode(read(q.prompt,/запись ([01]+)\./)[0],2),
  'clear-low-bit':q=>{const[s]=read(q.prompt,/числе ([01]+)₂/);const i=s.lastIndexOf('1');return decode(s.slice(0,i)+'0'+s.slice(i+1),2);},
  'binary-product':q=>{const[a,b]=[...q.prompt.matchAll(/([01]+)₂/g)].map(m=>decode(m[1],2));let v=0;for(let i=0;i<b;i++)v+=a;return v.toString(2);},
  'drop-right':q=>{const[n,k]=read(q.prompt,/числа (\d+)₁₀ удалили (\d+)/).map(Number);return decode(n.toString(2).slice(0,-k),2);},
  'low-bits':q=>{const[n,k]=read(q.prompt,/числа (\d+)₁₀ оставили только (\d+)/).map(Number);return decode(n.toString(2).slice(-k),2);},
  'largest-with-ones':q=>{const[k,m]=read(q.prompt,/ровно (\d+) разрядов и ровно (\d+) единиц/).map(Number);const valid=range(2**(k-1),2**k-1).filter(n=>[...n.toString(2)].filter(c=>c==='1').length===m);return valid.at(-1);},
  'octal-hex':q=>decode(read(q.prompt,/число (\d+)₈/)[0],8).toString(16).toUpperCase(),
  'median-mixed':q=>{const[a,b,c]=read(q.prompt,/числа: ([01]+)₂; (\d+)₈; ([0-9A-F]+)₁₆/);return[decode(a,2),decode(b,8),decode(c,16)].sort((a,b)=>a-b)[1];},
  'remove-leading':q=>{const[n]=read(q.prompt,/числа (\d+)₁₀/).map(Number);return decode(n.toString(2).slice(1),2);},
  'swap-bit-positions':q=>{const[n,p,k]=read(q.prompt,/числа (\d+)₁₀.*номерами (\d+) и (\d+)/).map(Number);const s=[...n.toString(2).padStart(Math.max(p,k)+1,'0')].reverse();[s[p],s[k]]=[s[k],s[p]];return decode(s.reverse().join(''),2);},
  'repeat-block':q=>{const[n,k]=read(q.prompt,/числа (\d+)₁₀.*по (\d+) бит/).map(Number),s=n.toString(2);assert.equal(s.length,2*k);assert.equal(s.slice(0,k),s.slice(k));return decode(s.slice(0,k),2);},
  'ternary-power-zeros':q=>{const[a,b]=read(q.prompt,/3\^(\d+) \+ 3\^(\d+)/).map(Number);let n=3**a+3**b,count=0;while(n){if(n%3===0)count++;n=Math.floor(n/3);}return count;},
  'three-digit-base':q=>{const[s,n]=read(q.prompt,/Запись (\d+) .*равна (\d+) в/);const bs=range(2,36).filter(b=>[...s].every(c=>Number(c)<b)&&decode(s,b)===Number(n));assert.equal(bs.length,1);return bs[0];},
  'binary-palindromes':q=>{const[k]=read(q.prompt,/ровно (\d+) разрядов/).map(Number);return range(2**(k-1),2**k-1).filter(n=>{const s=n.toString(2);return s===[...s].reverse().join('');}).length;},
  'octal-last-range':q=>{const[a,b,d]=read(q.prompt,/от (\d+) до (\d+).*цифру (\d+)/).map(Number);return range(a,b).filter(n=>n.toString(8).endsWith(String(d))).length;},
 },
 'g8-logic':{
  'implication-value':q=>{const[a,b]=nums(q);return Number(!(a===1&&b===0));},
  'majority-three':q=>{const[a,b,c]=read(q.prompt,/сигналы (\d), (\d), (\d)/).map(Number);return Number((a&&b)||(a&&c)||(b&&c));},
  'operation-priority':q=>{const[a,b,c]=nums(q);return a===1?1:(b===1&&c===1?1:0);},
  'table-lookup':q=>{const[a,b]=nums(q);const rows=q.prompt.split('\n').slice(2).map(s=>s.split(' | ').map(Number));return rows.find(row=>row[0]===a&&row[1]===b)[2];},
  'compare-expression':q=>{const[a,b,c]=nums(q);return Number(Number(a+b>0)===c);},
  'switch-circuit':q=>{const[a,b,c]=nums(q);return Number((a===1&&c===0)||(b===1&&c===0));},
  'true-statements':q=>{const[x,a,b]=nums(q);return Number(x>=a)+Number(Math.abs(x)<b)+Number(x%2===0);},
  'exactly-two-rows':q=>{const[n]=nums(q);return range(0,2**n-1).filter(x=>[...x.toString(2)].filter(c=>c==='1').length===2).length;},
  'false-implication-rows':q=>{const[n]=nums(q);return range(0,2**n-1).filter(x=>{const s=x.toString(2).padStart(n,'0');return s[0]==='1'&&!(s[1]==='1'&&s[2]==='1');}).length;},
  'outside-two-intervals':q=>{const[n,a,b,c,d]=read(q.prompt,/до (\d+)\. .*\[(\d+); (\d+)\].*\[(\d+); (\d+)\]/).map(Number);return range(1,n).filter(x=>!(a<=x&&x<=b)&&!(c<=x&&x<=d)).length;},
  'least-odd-square':q=>{const[k]=read(q.prompt,/x² > (\d+)/).map(Number);return range(1,k+2).find(x=>x%2===1&&x*x>k);},
  'largest-remainder':q=>{const[b,k,d]=read(q.prompt,/x < (\d+)\).*делении на (\d+) равен (\d+)/).map(Number);return range(0,b-1).reverse().find(x=>x-k*Math.floor(x/k)===d);},
  'identify-operation':q=>{const rows=q.prompt.split('\n').slice(2).map(s=>s.split(' | ').map(Number)),operations=[(a,b)=>a&&b,(a,b)=>a||b,(a,b)=>a!==b];return operations.findIndex(fn=>rows.every(([a,b,f])=>Number(fn(a,b))===f))+1;},
  'two-remainders':q=>{const[a,b,d,k]=read(q.prompt,/\[(\d+); (\d+)\].*остаток (\d+) при делении на (\d+)/).map(Number);let count=0;for(let x=d;x<=b;x+=k)if(x>=a&&x%2!==0)count++;return count;},
  'universal-bound':q=>{const[a,b,k]=read(q.prompt,/\[(\d+); (\d+)\] истинно (\d+) ×/).map(Number);return range(0,k*b+2).find(A=>range(a,b).every(x=>k*x<A));},
  'exactly-two-predicates':q=>{const[n,a,k]=read(q.prompt,/до (\d+).*x > (\d+); x делится на (\d+)/).map(Number);return range(1,n).filter(x=>[x%2===0,x>a,x%k===0].filter(Boolean).length===2).length;},
  'first-counterexample':q=>{const[n,a,k]=read(q.prompt,/до (\d+).*выражения \(x > (\d+)\) ИЛИ \(x делится на (\d+)\)/).map(Number);return range(1,n).find(x=>Number(x>a)+Number(x%k===0)===1);},
  'survey-neither':q=>{const[n,a,b,both]=nums(q);let union=new Set(range(1,a));for(let i=1;i<=b-both;i++)union.add(a+i);return n-union.size;},
  'pairs-with-sum':q=>{const[n,limit]=read(q.prompt,/x ≤ (\d+),.*x \+ y ≤ (\d+)/).map(Number);let count=0;for(let mask=0;mask<n*n;mask++){const x=Math.floor(mask/n)+1,y=mask%n+1;if(x<y&&x+y<=limit)count++;}return count;},
  'monotone-truth':q=>{const[n]=nums(q);return range(0,2**n-1).filter(x=>!x.toString(2).padStart(n,'0').includes('10')).length;},
 },
 'g8-information':{
  'mixed-volume':q=>{const[k,b]=nums(q);return k*1024+b;},
  'color-components':q=>{const[p,c,b]=nums(q);let v=0;for(let i=0;i<p;i++)v+=c*b;return v/8;},
  'audio-channel-change':q=>nums(q)[0]+nums(q)[0],
  'payload-size':q=>{const[v,h,c]=nums(q);return v-h-c;},
  'sensor-period':q=>{const[b,p,,t]=nums(q);let v=0;for(let s=p;s<=t;s+=p)v+=b;return v;},
  'row-thinning':q=>{const[w,h,k]=nums(q);let pixels=0;for(let y=1;y<=h;y++)if(y%k===0)pixels+=w;return pixels;},
  'restore-before-compress':q=>{const[p,v]=nums(q);return v/(1-p/100);},
  'shared-channel':q=>{const[v,n,size]=nums(q);return size*8*n/v;},
  'palette-in-file':q=>{const[n,c,e]=nums(q);return n*bits(c)/8+c*e;},
  'row-padding':q=>{const[w,h,d]=nums(q);let row=0;for(let i=0;i<w*d;i+=8)row++;return row*h;},
  'frame-rate':q=>{const[t,v,w,h]=nums(q);return v/(w*h*t);},
  'audio-duration':q=>{const[size,f,d]=nums(q);return size*8/f/d/2;},
  'line-separators':q=>{const[n,c,b,s]=nums(q);return Array.from({length:n},()=>Array(c).fill('x'.repeat(b)).join('')).join('_'.repeat(s)).length;},
  'unit-definitions':q=>{const[n]=read(q.prompt,/по (\d+) Кбайт/).map(Number);return n*1024-n*1000;},
  'store-forward':q=>{const[s,a,b,t]=nums(q);return s/a+s/b+t;},
  'packet-retries':q=>{const[n,d,h,retry]=nums(q);let v=0;for(let i=0;i<n+retry;i++)v+=d+h;return v;},
  'compression-time-benefit':q=>{const[size,v,t,p]=nums(q);return size/v-(t+size*(100-p)/100/v);},
  'resize-and-depth':q=>{const[w,h,d,sx,sy,newD]=nums(q);const old=w*h*d,newSize=(w*sx)*(h*sy)*newD;return(newSize-old)/8;},
  'alphabet-change-padding':q=>{const[n,a,b]=nums(q);return Math.floor((n*bits(b)+7)/8)-Math.floor((n*bits(a)+7)/8);},
  'useful-percentage':q=>{const[n,d,h]=nums(q);return (n*d)/(n*d+n*h)*100;},
 }
};
const configs=[{seed:1,edge:'min'},{seed:2,edge:'max'},...Array.from({length:22},(_,i)=>({seed:1430+i*113}))];

test('second grade8 extension has 80 different IDs and balanced levels in four topics',()=>{
  assert.equal(entries.length,80);assert.equal(new Set(entries.map(e=>`${e.topic}-${e.key}`)).size,80);
  for(const topic of ['g8-bases','g8-logic','g8-information','g8-algorithms']){
    const group=entries.filter(e=>e.topic===topic);assert.equal(group.length,20);
    assert.deepEqual(['basic','standard','advanced'].map(level=>group.filter(e=>e.difficulty===level).length),[7,7,6]);
  }
  for(const e of entries){assert.ok(e.key.startsWith('plus-'));assert.ok(e.reason.length>10);const seen=new Set();for(const config of configs){const q=e.build(random(config.seed,config.edge));assert.ok(q.solutionSteps.length>=2,e.key);assert.ok(q.solutionSteps.every(s=>typeof s==='string'&&s.length>=10),e.key);assert.ok(new Set(q.solutionSteps).size>=2,e.key);assert.ok(q.prompt.length>15);assert.doesNotMatch(JSON.stringify(q),/undefined|NaN|Infinity/,e.key);seen.add(JSON.stringify([q.prompt,q.code]));}assert.ok(seen.size>1,`${e.key}: variable condition expected`);}
});

test('1440 grade8 conditions checked with independently parsed rules, including boundary generators',()=>{
  let count=0;const signs=new Set();
  for(const e of entries.filter(e=>e.topic!=='g8-algorithms'))for(const config of configs){const q=e.build(random(config.seed,config.edge)),key=e.key.slice(5),fn=solve[e.topic]?.[key];assert.ok(fn,key);const expected=fn(q);if(q.kind==='number')assert.ok(Math.abs(Number(q.answer)-Number(expected))<1e-8,`${e.key}: ${q.prompt}\nExpected ${expected}; got ${q.answer}`);else assert.equal(q.answer,String(expected),`${e.key}: ${q.prompt}`);if(key==='compression-time-benefit')signs.add(Math.sign(Number(q.answer)));count++;}
  assert.equal(count,1440);assert.ok(signs.has(-1)&&signs.has(1));
  const compression=entries.find(e=>e.key==='plus-compression-time-benefit');
  const chosen=[10,20,20],equalTime=compression.build({int:()=>chosen.shift(),pick:()=>50});
  assert.equal(Number(equalTime.answer),0);assert.equal(solve['g8-information']['compression-time-benefit'](equalTime),0);
});

test('480 new grade8 Python traces agree with independent CPython execution',()=>{
  const cases=[];for(const e of entries.filter(e=>e.topic==='g8-algorithms'))for(const config of configs){const q=e.build(random(config.seed,config.edge));cases.push({id:e.key,code:q.code,answer:q.answer});}
  assert.equal(cases.length,480);
  const script='import json,sys,io,contextlib\nresults=[]\nfor case in json.load(sys.stdin):\n out=io.StringIO()\n with contextlib.redirect_stdout(out):\n  exec(compile(case["code"],"<bank>","exec"),{})\n results.append(out.getvalue().strip())\njson.dump(results,sys.stdout)';
  const result=spawnPythonSync(['-c',script],{input:JSON.stringify(cases),encoding:'utf8',timeout:20000,maxBuffer:2**20});
  assert.equal(result.status,0,result.stderr);const outputs=JSON.parse(result.stdout);
  for(let i=0;i<cases.length;i++)assert.equal(outputs[i],cases[i].answer,cases[i].id+'\n'+cases[i].code);
});
