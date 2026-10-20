import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import {TEMPLATE_CATALOG,generateQuestions} from '../js/bank.js';

const rows=TEMPLATE_CATALOG.filter(t=>t.id.startsWith('g11-')&&t.id.includes('-plus-'));
const nums=s=>(s.match(/-?\d+/g)||[]).map(Number);
const match=(s,re)=>{const m=s.match(re);assert.ok(m,`Не разобрано условие: ${s}`);return m.slice(1);};
const list=s=>s.split(', ').map(Number);
const key=q=>q.templateId.split('-plus-')[1];
const sum=a=>a.reduce((s,x)=>s+x,0);
const range=n=>Array.from({length:n},(_,i)=>i);
const edges=p=>[...p.matchAll(/(\d+)—(\d+)(?::(\d+))?/g)].map(m=>[+m[1],+m[2],m[3]==null?1:+m[3]]);
function components(n,e){const labels=range(n);for(const [u,v]of e){const old=labels[v],now=labels[u];for(let i=0;i<n;i++)if(labels[i]===old)labels[i]=now;}return new Set(labels).size;}
function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t])):[[]];}
function routes(n,e,start,end){const result=[];function visit(v,seen,cost,weights){if(v===end){result.push({cost,weights});return;}for(const [a,b,w]of e){const to=a===v?b:b===v?a:-1;if(to>=0&&!seen.has(to))visit(to,new Set([...seen,to]),cost+w,[...weights,w]);}}visit(start,new Set([start]),0,[]);return result;}
const graphOracles={
  'cycle-radius':p=>{const[n]=nums(p);return Math.max(...range(n).map(i=>Math.min(i,n-i)));},
  'complete-edge-removal':p=>{const[n]=nums(p);let count=0;for(let a=1;a<n;a++)for(let b=a+1;b<n;b++)count++;return count;},
  'bipartite-missing':p=>{const[a,b,m]=nums(p);return Array.from({length:a},()=>Array(b).fill(1)).flat().length-m;},
  'odd-degrees':p=>{const end=+match(p,/Вершины 0…(\d+)/)[0],e=edges(p),d=Array(end+1).fill(0);e.forEach(([a,b])=>{d[a]++;d[b]++;});return d.filter(x=>x%2!==0).length;},
  'isolated-vertices':p=>{const end=+match(p,/вершины 0…(\d+)/)[0],used=new Set(edges(p).flatMap(([a,b])=>[a,b]));return end+1-used.size;},
  'path-eccentricity':p=>{const[end]=match(p,/Вершины 0…(\d+)/).map(Number),[v]=match(p,/от вершины (\d+)/).map(Number);return Math.max(...range(end+1).map(x=>Math.abs(x-v)));},
  'directed-sinks':p=>{const[end]=match(p,/Вершины 0…(\d+)/).map(Number),from=new Set([...p.matchAll(/(\d+)→(\d+)/g)].map(m=>+m[1]));return end+1-from.size;},
  'star-return-walks':p=>{const[leaves,steps]=nums(p);let d=[1,...Array(leaves).fill(0)];for(let i=0;i<steps;i++)d=[sum(d.slice(1)),...Array(leaves).fill(d[0])];return d[0];},
  'triangle-count':p=>{const e=edges(p),a=Array.from({length:5},()=>Array(5).fill(false));for(const[u,v]of e)a[u][v]=a[v][u]=true;let directed=0;for(let i=0;i<5;i++)for(let j=0;j<5;j++)for(let k=0;k<5;k++)if(a[i][j]&&a[j][k]&&a[k][i])directed++;return directed/6;},
  'connected-components':p=>components(7,edges(p)),
  'cycle-tail-bridges':p=>{const[n,k]=nums(p);const e=[...range(n).map(i=>[i,(i+1)%n]),...range(k).map(i=>[i?n+i-1:0,n+i])];return e.filter((_,i)=>components(n+k,e.filter((_,j)=>i!==j))>1).length;},
  'one-diagonal':p=>{const[x,y]=match(p,/в \((\d+);(\d+)\)/).map(Number);const d=Array.from({length:x+1},()=>Array.from({length:y+1},()=>[0,0]));d[0][0][0]=1;for(let i=0;i<=x;i++)for(let j=0;j<=y;j++)for(let used=0;used<=1;used++){const v=d[i][j][used];if(i<x)d[i+1][j][used]+=v;if(j<y)d[i][j+1][used]+=v;if(!used&&i<x&&j<y)d[i+1][j+1][1]+=v;}return d[x][y][1];},
  'complete-simple-three':p=>{const[n]=nums(p);let c=0;for(let a=2;a<n;a++)for(let b=2;b<n;b++)if(a!==b)c++;return c;},
  'chain-express':p=>{const[body]=match(p,/по порядку ([\d, ]+) км/),[extra]=match(p,/1—4 длиной (\d+)/).map(Number),e=list(body).map((w,i)=>[i,i+1,w]);e.push([1,4,extra]);return Math.min(...routes(6,e,0,5).map(x=>x.cost));},
  'dag-exact-length':p=>{const[end,k]=match(p,/Вершины 0…(\d+).*ровно из (\d+) дуг/).map(Number);const d=Array.from({length:k+1},()=>Array(end+1).fill(0));d[0][0]=1;for(let step=1;step<=k;step++)for(let v=1;v<=end;v++)for(let from=0;from<v;from++)d[step][v]+=d[step-1][from];return d[k][end];},
  'shortest-multiplicity':p=>{const pairs=[...p.matchAll(/\((\d+);(\d+)\)/g)].map(m=>[+m[1],+m[2]]),costs=range(16).map(mask=>sum(pairs.map((pair,i)=>pair[mask>>i&1]))),best=Math.min(...costs);return costs.filter(x=>x===best).length;},
  'four-node-mst':p=>{const e=edges(p),costs=[];for(let i=0;i<e.length;i++)for(let j=i+1;j<e.length;j++)for(let k=j+1;k<e.length;k++){const chosen=[e[i],e[j],e[k]];if(components(4,chosen)===1)costs.push(sum(chosen.map(x=>x[2])));}return Math.min(...costs);},
  'one-free-edge':p=>Math.min(...routes(4,edges(p),0,3).map(x=>x.cost-Math.max(...x.weights))),
  'cycle-fixed-edge':p=>{const[n]=nums(p);let c=0;for(const order of permutations(range(n-1).map(x=>x+1))){if(order[0]!==1&&order.at(-1)!==1)continue;c++;}return c/2;},
  'visit-three':p=>{const e=edges(p),weight=(u,v)=>e.find(([a,b])=>a===u&&b===v||a===v&&b===u)[2];return Math.min(...permutations([1,2,3]).map(order=>sum([0,...order].map((x,i)=>weight(x,[...order,0][i])))));},
};
function mergeBrute(a,memo=new Map()){if(a.length===1)return 0;const id=[...a].sort((x,y)=>x-y).join(',');if(memo.has(id))return memo.get(id);let best=Infinity;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const merged=a[i]+a[j],rest=a.filter((_,k)=>k!==i&&k!==j);best=Math.min(best,merged+mergeBrute([...rest,merged],memo));}memo.set(id,best);return best;}
const dataOracles={
  'sample-spread':p=>{const a=list(match(p,/измерений: ([\d, -]+)\./)[0]);return Math.max(...a.flatMap(x=>a.map(y=>x-y)));},
  'weighted-average':p=>{const[a,n,b,m]=nums(p);const values=[...Array(n).fill(a),...Array(m).fill(b)];return sum(values)/values.length;},
  'distinct-pairs':p=>{const a=[...p.matchAll(/\((\d+);(\d+)\)/g)].map(m=>m[1]+','+m[2]);return a.filter((x,i)=>a.indexOf(x)===i).length;},
  'toggle-mask':p=>{const[a,b]=match(p,/флагов: ([01]{8})\. Маска переключения: ([01]{8})/);return [...a].filter((c,i)=>c!==b[i]).length;},
  'dictionary-saving':p=>{const[len,n,ref]=nums(p);return (n-1)*len-n*ref;},
  'inclusive-sampling':p=>{const[step,end,bytes]=match(p,/каждые (\d+) секунд до момента (\d+).*замер занимает (\d+) байт/).map(Number);let total=0;for(let t=0;t<=end;t+=step)total+=bytes;return total;},
  'delete-filter':p=>{const[body,edge]=match(p,/Значения: ([\d, -]+)\..*x>(\d+)/);return list(body).filter(x=>x>=0&&x<=+edge).length;},
  'unmatched-rows':p=>{const[a,b]=match(p,/A: ([\d, ]+)\. Ключи таблицы B: ([\d, ]+)\./).map(list);return a.filter(x=>b.every(y=>x!==y)).length;},
  'group-max-total':p=>{const rows=[...p.matchAll(/\((\d+);(\d+)\)/g)].map(m=>[+m[1],+m[2]]);return Math.max(...[1,2,3].map(k=>sum(rows.filter(x=>x[0]===k).map(x=>x[1]))));},
  'rle-position':p=>{const[a,b,c,d,pos]=nums(p);const s='1'.repeat(a)+'2'.repeat(b)+'3'.repeat(c)+'4'.repeat(d);return Number(s[pos-1]);},
  'delta-distance':p=>{const a=list(match(p,/Измерения: ([\d, -]+)\./)[0]);return a.slice(1).reduce((v,x,i)=>v+(x>=a[i]?x-a[i]:a[i]-x),0);},
  'broadcast-octet':p=>{const[host,prefix]=match(p,/10\.20\.30\.(\d+).*\/([\d]+)/).map(Number),mask=(255<<(32-prefix))&255;return (host&mask)|(255-mask);},
  'common-prefix':p=>{const[a,b]=match(p,/записи: ([01]{8}) и ([01]{8})/);for(let i=0;i<8;i++)if(a.slice(0,i+1)!==b.slice(0,i+1))return i;return 8;},
  'merged-rank':p=>{const[a,b,k]=match(p,/A: ([\d, ]+); B: ([\d, ]+)\..*позиции (\d+)/),x=list(a),y=list(b),out=[];while(x.length||y.length){if(!y.length||x.length&&x[0]<=y[0])out.push(x.shift());else out.push(y.shift());}return out[+k-1];},
  'paged-storage':p=>{const[page,head,record,count]=nums(p);let pages=1,free=page-head;for(let i=0;i<count;i++){if(free<record){pages++;free=page-head;}free-=record;}return pages*page;},
  'codec-choice':p=>{const[n,ha,pa,hb,pb]=nums(p);return Math.min(sum(Array(n).fill(pa))+ha,sum(Array(n).fill(pb))+hb);},
  'merge-cost':p=>mergeBrute(list(match(p,/размером ([\d, ]+) единиц/)[0])),
  'simultaneous-intervals':p=>{const intervals=[...p.matchAll(/\[(\d+);(\d+)\)/g)].map(m=>[+m[1],+m[2]]),max=Math.max(...intervals.flat());return Math.max(...range(max*2+1).map(i=>intervals.filter(([a,b])=>a<=i/2&&i/2<b).length));},
  'divisible-product-pairs':p=>{const[body,k]=match(p,/Значения: ([\d, ]+)\..*делящееся на (\d+)/),a=list(body);let c=0;for(let i=0;i<a.length;i++)for(let j=0;j<a.length;j++)if(i!==j&&a[i]*a[j]%Number(k)===0)c++;return c/2;},
  'checksum-missing':p=>{const[body,target]=match(p,/байты: ([\d, ]+)\..*равна (\d+)\./),a=list(body);const valid=range(256).filter(x=>(sum(a)+x)%256===+target);assert.equal(valid.length,1);return valid[0];},
};

const configs=Array.from({length:12},(_,i)=>({seed:137+i*997,variant:i%30+1}));
const generated=()=>rows.flatMap(t=>configs.map(c=>generateQuestions({grade:11,templateIds:[t.id],...c})[0]));

test('grade 11 second extension has 80 distinct types with balanced levels and concrete solutions',()=>{
  assert.equal(rows.length,80);assert.equal(new Set(rows.map(t=>t.id)).size,80);
  for(const topic of ['algorithms','programming','graphs','data']){
    const selected=rows.filter(t=>t.topicId===`g11-${topic}`);assert.equal(selected.length,20);
    assert.deepEqual(['basic','standard','advanced'].map(d=>selected.filter(t=>t.difficulty===d).length),[7,7,6]);
  }
  for(const q of generated()){
    assert.ok(q.solutionSteps?.length>=2,q.templateId);assert.ok(q.solutionSteps.every(x=>x.length>=10));
    assert.ok(!/NaN|Infinity|undefined/.test(q.prompt+' '+q.answer+' '+q.solutionSteps.join(' ')),q.templateId);
    if(q.kind==='program'){assert.ok(q.tests.length>=3);assert.ok(!/^\s*(?:import|from)\s/m.test(q.answer));}
  }
  for(const row of rows){const samples=configs.slice(0,8).map(c=>generateQuestions({grade:11,templateIds:[row.id],...c})[0]);assert.ok(new Set(samples.map(q=>q.prompt+(q.code||''))).size>1,`${row.id}: fixed condition`);}
});

test('grade 11 graph and data keys match independent parsers and exhaustive solvers',()=>{
  let checks=0;
  for(const q of generated().filter(q=>['g11-graphs','g11-data'].includes(q.topicId))){
    const solve=(q.topicId==='g11-graphs'?graphOracles:dataOracles)[key(q)];assert.ok(solve,q.templateId);
    assert.equal(String(solve(q.prompt)),q.answer,`${q.templateId}: ${q.prompt}`);checks++;
  }
  assert.equal(checks,480);
});

const pythonOracle=String.raw`
import json, sys
from collections import Counter
from bisect import bisect_left

def oracle(key, text, prompt):
    a = list(map(int, text.split())) if key not in ('longest-word',) else []
    if key == 'parity-switches': return sum((x-y)%2 != 0 for x,y in zip(a,a[1:]))
    if key == 'first-minimum': return min(range(len(a)), key=lambda i:(a[i],i))+1
    if key == 'weighted-position': return sum(i*x for i,x in enumerate(a,1))
    if key == 'above-previous': return sum(x<y for x,y in zip(a,a[1:]))
    if key == 'equal-run':
        best = 0
        for i in range(len(a)):
            j=i
            while j<len(a) and a[j]==a[i]: j+=1
            best=max(best,j-i)
        return best
    if key == 'digit-alternation': return sum(map(int,text.strip()[::2]))-sum(map(int,text.strip()[1::2]))
    if key == 'strict-between':
        left,right=sorted((min(range(len(a)),key=lambda i:a[i]),max(range(len(a)),key=lambda i:a[i])))
        return sum(a[i] for i in range(len(a)) if left<i<right)
    if key == 'prefix-maximum': return max(sum(a[:i]) for i in range(1,len(a)+1))
    if key == 'later-profit': return max(a[j]-a[i] for i in range(len(a)) for j in range(i+1,len(a)))
    if key == 'stable-zero-move': return ' '.join(map(str,sorted(a,key=lambda x:x==0)))
    if key == 'base-representation':
        import re
        base=int(re.search(r'основанием (\d+)',prompt).group(1));n=a[0];digits=[]
        while n: n,d=divmod(n,base);digits.append(str(d))
        return ''.join(reversed(digits)) or '0'
    if key == 'longest-word': return max(map(len,text.split()))
    if key == 'intersection-values':
        left,right=(list(map(int,line.split())) for line in text.strip().splitlines())
        return len(set(x for x in left if x in right))
    if key == 'frequency-leader': return min(set(a),key=lambda x:(-a.count(x),x))
    if key == 'inversion-count': return sum(x>y for i,x in enumerate(a) for y in a[i+1:])
    if key == 'shortest-positive-window':
        target=a.pop(0);lengths=[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if sum(a[i:j])>=target]
        return min(lengths,default=0)
    if key == 'zero-sum-fragments': return sum(sum(a[i:j])==0 for i in range(len(a)) for j in range(i+1,len(a)+1))
    if key == 'maximum-pair-product': return max(x*y for i,x in enumerate(a) for y in a[i+1:])
    if key == 'distinct-window':
        answer=0
        for i in range(len(a)):
            for j in range(i+1,len(a)+1):
                if len(set(a[i:j]))!=j-i: break
                answer=max(answer,j-i)
        return answer
    if key == 'lis-length':
        tails=[]
        for x in a:
            i=bisect_left(tails,x)
            if i==len(tails): tails.append(x)
            else: tails[i]=x
        return len(tails)
    raise ValueError(key)

payload=json.load(sys.stdin)
results=[]
for q in payload:
    key=q['templateId'].split('-plus-')[1]
    if q.get('code'):
        import io, contextlib
        output=io.StringIO()
        with contextlib.redirect_stdout(output): exec(q['code'],{})
        assert output.getvalue().strip()==q['answer'],(key,output.getvalue(),q['answer'])
        results.append(1)
    else:
        for sample in q['tests']:
            expected=str(oracle(key,sample['input'],q['prompt']))
            assert expected.strip()==sample['output'].strip(),(key,'oracle',sample['input'],expected,sample['output'])
            import io, contextlib
            output=io.StringIO();lines=iter(sample['input'].splitlines())
            with contextlib.redirect_stdout(output): exec(q['answer'],{'input':lambda:next(lines)})
            assert output.getvalue().strip()==expected.strip(),(key,'program',sample['input'],output.getvalue(),expected)
            results.append(1)
print(len(results))
`;

test('grade 11 new Python traces and program tests match independent Python input oracles',()=>{
  const tasks=generated().filter(q=>q.code||q.kind==='program');assert.equal(tasks.length,480);
  const result=spawnPythonSync(['-c',pythonOracle],{input:JSON.stringify(tasks),encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000});
  assert.equal(result.status,0,result.stderr);assert.ok(Number(result.stdout)>=1200,result.stdout);
});
