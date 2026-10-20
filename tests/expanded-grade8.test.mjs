import {test} from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {registerGrade8} from '../js/bank-grade8.js';
const entries=[];
registerGrade8({
 add:(topic,key,title,difficulty,reason,build)=>entries.push({topic,key,title,difficulty,reason,build}),
 numeric:(prompt,answer,explanation,extra={})=>({kind:'number',prompt,answer:String(answer),explanation,points:1,...extra}),
 textual:(prompt,answer,explanation,extra={})=>({kind:'text',prompt,answer:String(answer),explanation,points:1,...extra}),
 codeOutput:(code,answer,explanation)=>({kind:'number',prompt:'Какое число выведет программа Python?',code,answer:String(answer),explanation,points:1}),
 choice:(prompt,right,wrong,explanation,r)=>{const labels=[right,...wrong];const shift=r.int(0,labels.length-1);labels.push(...labels.splice(0,shift));return {kind:'choice',prompt,answer:String(labels.indexOf(right)),options:labels.map((label,i)=>({label,value:String(i)})),explanation,points:1};}
});
function random(seed,edge){let x=seed>>>0;const r=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};r.int=(a,b)=>edge==='min'?a:edge==='max'?b:a+Math.floor(r()*(b-a+1));r.pick=a=>a[r.int(0,a.length-1)];r.array=(n,a,b)=>Array.from({length:n},()=>r.int(a,b));return r;}
const nums=q=>(q.prompt.match(/-?\d+/g)||[]).map(Number);
const range=(a,b)=>Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i);
function ones(n){let c=0;while(n>0){c+=n%2;n=Math.floor(n/2);}return c;}
function decode(s,b){return [...s].reduce((n,c)=>n*b+parseInt(c,36),0);}
const rules={
 'g8-bases':{
  'bit-count':q=>q.prompt.match(/(\d+)₂/)[1].length,
  ones:q=>ones(decode(q.prompt.match(/(\d+)₂/)[1],2)),
  parity:q=>decode(q.prompt.match(/(\d+)₂/)[1],2)%2,
  'place-weight':q=>{const [b,p]=nums(q);let n=1;for(let i=0;i<p;i++)n*=b;return n;},
  'largest-digit':q=>nums(q)[0]-1,
  subtract:q=>{const [a,b]=[...q.prompt.matchAll(/(\d+)₂/g)].map(m=>decode(m[1],2));return (a-b).toString(2);},
  'append-zeros':q=>{const[n,k]=nums(q);return decode(n.toString(2)+'0'.repeat(k),2);},
  'mixed-difference':q=>{const m=q.prompt.match(/([0-9A-F]+)₁₆ − (\d+)₈/);return decode(m[1],16)-decode(m[2],8);},
  'digit-sum':q=>{let [n,b]=nums(q),s=0;while(n){s+=n%b;n=Math.floor(n/b);}return s;},
  'smallest-length':q=>{const [k]=nums(q);let n=1;while(n.toString(2).length<k)n++;return n;},
  'unknown-base':q=>{const m=q.prompt.match(/число (\d\d).*равно (\d+)/);const found=range(2,36).filter(b=>[...m[1]].every(d=>Number(d)<b)&&decode(m[1],b)===Number(m[2]));assert.equal(found.length,1);return found[0];},
  'missing-digit':q=>{const m=q.prompt.match(/(\d)\?(\d)₈.*равно (\d+)/);return range(0,7).find(d=>decode(m[1]+d+m[2],8)===Number(m[3]));},
  'range-two-ones':q=>{const[a,b]=nums(q);return range(a,b).filter(n=>ones(n)===2).length;},
  'power-ones':q=>{const [,k,,m]=nums(q);return ones(2**k+2**m-1);},
  'reverse-record':q=>{const[n]=nums(q);return decode([...n.toString(2)].reverse().join(''),2);}
 },
 'g8-logic':{
  'and-predicates':q=>{const[x,a,k]=nums(q);return Number(x>a&&x%k===0);},
  'nor-predicates':q=>{const[x,a,k]=nums(q);return Number(x>=a&&x%k!==0);},
  'xor-predicates':q=>{const[x,a,b]=nums(q);return Number(Number(x>a)+Number(x<b)===1);},
  'same-truth':q=>{const[x,a]=nums(q);return Number((x%2===0)===(x>=a));},
  'not-comparison':q=>{const[x,a]=nums(q);return Number(x>a);},
  'union-count':q=>{const[a,b,c,d]=nums(q);return new Set([...range(a,b),...range(c,d)]).size;},
  'even-count':q=>{const[a,b]=nums(q);return range(a,b).filter(x=>x>a&&x<b&&x%2===0).length;},
  'neither-divisor':q=>{const[,n,,k]=nums(q);return range(1,n).filter(x=>x%2&&x%k).length;},
  'exactly-one-range':q=>{const[a,b,c,d]=nums(q);return range(a,d).filter(x=>Number(x>=a&&x<=b)+Number(x>=c&&x<=d)===1).length;},
  'fixed-truth-rows':q=>{const[n,v]=nums(q);return range(0,2**n-1).filter(x=>(x&1)===v).length;},
  'divisible-not':q=>{const[a,b,k,m]=nums(q);return range(a,b).filter(x=>x%k===0&&x%m!==0).length;},
  'square-count':q=>{const[a,b,c]=nums(q);return range(a,b).filter(x=>x*x<c).length;},
  'demorgan-choice':q=>{const[a,b]=nums(q);function evalOption(label,x){const m=label.match(/\(x ([≤<]) (\d+)\) (ИЛИ|И) \(x ([≥>]) (\d+)\)/);if(m){const p=m[1]==='≤'?x<=+m[2]:x<+m[2],s=m[4]==='≥'?x>=+m[5]:x>+m[5];return m[3]==='И'?p&&s:p||s;}const k=label.match(/\(x > (\d+)\) ИЛИ \(x < (\d+)\)/);assert.ok(k);return x>+k[1]||x<+k[2];}const valid=q.options.filter(o=>range(a-2,b+2).every(x=>evalOption(o.label,x)===!(x>a&&x<b)));assert.equal(valid.length,1);return valid[0].value;},
  'xor-divisibility':q=>{const[,n,,k]=nums(q);return range(1,n).filter(x=>Number(x%2===0)+Number(x%k===0)===1).length;},
  'not-outside':q=>{const[a,b,k]=nums(q);return range(a-2,b+2).filter(x=>!(x<a||x>b)&&x%k!==0).length;}
 },
 'g8-information':{
  speed:q=>{const[v,t]=nums(q);return v/t;},
  'palette-depth':q=>{const[c]=nums(q);return range(1,16).find(b=>2**b>=c);},
  'symbol-count':q=>{const[v,b]=nums(q);return v/b;},
  'image-width':q=>{const[v,,h]=nums(q);return v/h;},
  'saved-space':q=>{const[v,p]=nums(q);return v-v*(1-p/100);},
  'video-frames':q=>{const[w,h,d,f,t]=nums(q);let v=0;for(let i=0;i<f*t;i++)v+=w*h*d/8;return v;},
  audio:q=>{const[f,d,t]=nums(q);return f*t*(d/8);},
  'packet-overhead':q=>{const[n,d,h]=nums(q);return n*d+n*h;},
  reencode:q=>{const[a,b,v]=nums(q);return v/(a-b);},
  'images-fit':q=>{const[c,w,h,d]=nums(q),v=w*h*d/8;let n=0;while((n+1)*v<=c)n++;return n;},
  'compress-transfer':q=>{const[v,p,s]=nums(q);return (v-v*p/100)/(s/8);},
  'crop-border':q=>{const[w,h,b,d]=nums(q);let pix=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x>=b&&x<w-b&&y>=b&&y<h-b)pix++;return pix*d/8;},
  'nonpower-palette':q=>{const[n,c]=nums(q);const k=range(1,16).find(b=>2**b>=c);return n*k/8;},
  'two-speeds':q=>{const[t1,v1,t2,v2]=nums(q);return Array(t1).fill(v1).concat(Array(t2).fill(v2)).reduce((a,b)=>a+b,0);},
  allocation:q=>{const[v,b]=nums(q);let total=0;while(total<v)total+=b;return total-v;}
 }
};
test('grade8 adds 60 balanced types and independently validates every key from its statement',()=>{
 assert.equal(entries.length,60);assert.equal(new Set(entries.map(e=>e.topic+'-'+e.key)).size,60);
 for(const topic of ['g8-bases','g8-logic','g8-information','g8-algorithms'])for(const level of ['basic','standard','advanced'])assert.equal(entries.filter(e=>e.topic===topic&&e.difficulty===level).length,5);
 const programs=[];let mathChecks=0;
 for(const e of entries)for(const [seed,edge] of [[1,'min'],[1,'max'],[4],[17],[1430],[8192],[2026],[99999]]){
  const q=e.build(random(seed,edge));assert.ok(q.prompt&&q.answer!=null,e.key);assert.ok(q.solutionSteps.length>=2&&q.solutionSteps.every(s=>s.length>=10),e.key);assert.equal(new Set(q.solutionSteps).size,q.solutionSteps.length,e.key);
  if(q.code){programs.push({id:e.key,code:q.code,expected:q.answer});continue;}
  const oracle=rules[e.topic]?.[e.key.slice(4)];assert.ok(oracle,`missing oracle ${e.key}`);const answer=oracle(q);
  if(typeof answer==='number')assert.ok(Math.abs(Number(q.answer)-answer)<1e-8,`${e.key}: ${q.prompt}: expected ${answer}, got ${q.answer}`);else assert.equal(q.answer,String(answer),`${e.key}: ${q.prompt}`);
  if(q.kind==='choice')assert.equal(new Set(q.options.map(o=>o.label)).size,q.options.length);mathChecks++;
 }
 assert.equal(mathChecks,45*8);assert.equal(programs.length,15*8);
 const code=`import json,sys,io,contextlib\nfor item in json.load(sys.stdin):\n    out=io.StringIO()\n    with contextlib.redirect_stdout(out):\n        exec(compile(item['code'],item['id'],'exec'),{})\n    assert out.getvalue().strip()==item['expected'],(item,out.getvalue())\nprint('120 Python cases passed')\n`;
 const p=spawnPythonSync(['-c',code],{input:JSON.stringify(programs),encoding:'utf8',timeout:20000});assert.equal(p.status,0,p.stderr);
});
