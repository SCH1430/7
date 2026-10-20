import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerGrade7 } from '../js/bank-grade7.js';

// Tests reconstruct the answer from the wording, rather than reusing the generator's key.
const templates=[];
registerGrade7({
  add:(topicId,key,title,difficulty,difficultyReason,build)=>templates.push({id:`${topicId}-${key}`,topicId,title,difficulty,difficultyReason,build}),
  numeric:(prompt,answer,explanation)=>({kind:'number',prompt,answer:String(answer),explanation,points:1}),
  textual:(prompt,answer,explanation)=>({kind:'text',prompt,answer:String(answer),explanation,points:1}),
});
function random(seed) {
  let x=seed>>>0;
  const r=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  r.int=(a,b)=>a+Math.floor(r()*(b-a+1));r.pick=a=>a[r.int(0,a.length-1)];r.array=(n,a,b)=>Array.from({length:n},()=>r.int(a,b));return r;
}
const numbers=s=>(s.match(/\d+/g)||[]).map(Number);
const match=(s,re)=>{const m=s.match(re);assert.ok(m,`Could not parse ${re}: ${s}`);return m.slice(1);};
const factorialFreeBits=count=>{let width=0,capacity=1;while(capacity<count){capacity*=2;width++;}return width;};
const solvers={
  'minute-transfer':p=>{const[v,m]=numbers(p);let total=0;for(let sec=0;sec<m*60;sec++)total+=v;return total;},
  'whole-byte':p=>{const[size]=numbers(p);let bytes=0;while(bytes*8<size)bytes++;return bytes;},
  'symbol-count':p=>{const[size,unit]=numbers(p);let count=0;for(let remaining=size;remaining>0;remaining-=unit)count++;return count;},
  'transfer-rate':p=>{const[size,time]=numbers(p);return size/time;},
  'equal-parts':p=>{const[size,header,parts]=numbers(p);return(size-header)/parts;},
  'packet-overhead':p=>{const[count,data,header]=numbers(p);return Array(count).fill(data).reduce((a,b)=>a+b,0)+Array(count).fill(header).reduce((a,b)=>a+b,0);},
  'packet-count':p=>{const[size,capacity]=numbers(p);let left=size,count=0;while(left>0){left-=capacity;count++;}return count;},
  'download-remaining':p=>{const[size,rate,elapsed]=numbers(p);return size/rate-elapsed;},
  'channels-compare':p=>{const[size,slow,fast]=numbers(p);return size/slow-size/fast;},
  'compress-share':p=>{const[size,divisor]=numbers(p);return size*(divisor-1)/divisor;},
  'two-rates':p=>{const[a,first,b,second]=numbers(p);return [...Array(a).fill(first),...Array(b).fill(second)].reduce((s,v)=>s+v,0);},
  'send-pauses':p=>{const[count,size,rate,pause]=numbers(p);let time=0;for(let i=0;i<count;i++){time+=size/rate;if(i<count-1)time+=pause;}return time;},
  'buffer':p=>{const[input,output,seconds]=numbers(p);let stored=0;for(let i=0;i<seconds;i++){stored+=input;stored-=output;}return stored;},
  'record-padding':p=>{const[count,width]=numbers(p);let bytes=0;while(bytes*8<width)bytes++;return count*bytes;},
  'service-limit':p=>{const[limit,header,size]=numbers(p);let used=header,count=0;while(used+size<=limit){used+=size;count++;}return count;},

  'reserved-codes':p=>{const[width,reserved]=numbers(p);const codes=Array.from({length:2**width},(_,i)=>i.toString(2).padStart(width,'0'));return codes.length-reserved;},
  'minimum-width':p=>factorialFreeBits(numbers(p)[0]),
  'bitmap-row':p=>{const[row]=match(p,/Строка: ([01]+)\./);return [...row].reduce((n,c)=>n+Number(c),0);},
  'rotate-symbols':p=>{const[word]=match(p,/слово ([АБВГД]+)\./);const map={А:'Б',Б:'В',В:'Г',Г:'Д',Д:'А'};return [...word].map(c=>map[c]).join('');},
  'majority-bit':p=>{const[group]=match(p,/Получено ([01]{3})\./);return Number([...group].filter(c=>c==='1').length>=2);},
  'run-length':p=>{const groups=[...p.matchAll(/(\d+)[ЧБ]/g)];return groups.flatMap(g=>Array(Number(g[1])).fill('pixel')).length;},
  'variable-length':p=>{const[word]=match(p,/слова ([АБВ]+)\?/);return [...word].map(c=>({А:'0',Б:'10',В:'11'})[c]).join('').length;},
  'parity-bit':p=>{const[data]=match(p,/К данным ([01]+) справа/);return [...data].reduce((parity,bit)=>parity^Number(bit),0);},
  'coordinate-code':p=>{const[encoded]=match(p,/Расшифруйте ([\d ]+)\./);return encoded.split(' ').map(pair=>'АБВГДЕЖЗИ'[(Number(pair[0])-1)*3+Number(pair[1])-1]).join('');},
  'row-padding':p=>{const[w,h]=match(p,/ширина (\d+) пикселей, высота (\d+) строк/).map(Number);let total=0;for(let row=0;row<h;row++)for(let bit=0;bit<w;bit+=8)total++;return total;},
  'runs-saving':p=>{const[listed]=match(p,/длиной ([\d, ]+) пикселей/);const sizes=numbers(listed);return sizes.reduce((s,v)=>s+v,0)-sizes.length*2;},
  'prefix-choice':p=>{const[a,b]=match(p,/А задан код ([01]+), для Б — ([01]+)\./);const valid=['00','01','10','11'].filter(c=>[a,b].every(old=>!c.startsWith(old)&&!old.startsWith(c)));assert.equal(valid.length,1);return valid[0];},
  'repair-message':p=>{const[received]=match(p,/Получено: ([01 ]+)\./);return received.split(' ').map(g=>[...g].sort()[1]).join('');},
  'checkerboard':p=>{const[w,h]=match(p,/имеет (\d+) столбцов и (\d+) строк/).map(Number);let blacks=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x+y)%2===0)blacks++;return blacks;},
  'palette-expansion':p=>{const[pixels,oldColors,newColors]=numbers(p);return pixels*(factorialFreeBits(newColors)-factorialFreeBits(oldColors));},

  'base-name':p=>{const[name]=match(p,/называется ([\w.]+)\./);return name.slice(0,name.lastIndexOf('.'));},
  'parent-folder':p=>{const[path]=match(p,/к файлу: ([/\w.]+)\./);return path.split('/').slice(0,-1).join('/');},
  'extension-count':p=>{const[list]=match(p,/файлы: (.+)\. Сколько/),[target]=match(p,/имеют расширение (\w+)\?/);return list.split(', ').filter(name=>name.split('.').at(-1)===target).length;},
  'rename-count':p=>numbers(p)[0],
  'path-depth':p=>{const[path]=match(p,/Путь файла: ([/\w.]+)\./);return path.split('/').filter(Boolean).length-1;},
  'copy-move':p=>{const[a,b,copy,move]=numbers(p);return(a-move)+(b+copy+move);},
  'delete-subtree':p=>{const[root,child]=numbers(p);return[root,child].reduce((sum,n)=>sum+n,0);},
  'wildcard-one':p=>{const[list]=match(p,/Список файлов: (.+)\. Маска/),[mask]=match(p,/Маска (\w+\?\.txt):/);const regex=new RegExp('^'+mask.replace(/\./g,'\\.').replace('?','.')+'$');return list.split(', ').filter(file=>regex.test(file)).length;},
  'replace-count':p=>{const[before,copied,same]=numbers(p);return before-same+copied;},
  'storage-blocks':p=>{const[block]=numbers(p),[listed]=match(p,/файлов: ([\d, ]+) Кбайт/);return numbers(listed).reduce((total,size)=>{let allocated=0;while(allocated<size)allocated+=block;return total+allocated;},0);},
  'overwrite-space':p=>{const[free,old,fresh]=numbers(p);return free-(fresh-old);},
  'archive-extract':p=>{const[free,archive,extracted]=numbers(p);return free-(archive+extracted);},
  'relative-path':p=>{const[current]=match(p,/Текущая папка ([/\w]+)\./),[commands]=match(p,/переходы: (.+)\. Символ/);const path=current.split('/').filter(Boolean);for(const part of commands.split(', ')){if(part==='..')path.pop();else path.push(part);}return'/'+path.join('/');},
  'sync-missing':p=>{const[a,b]=match(p,/Исходная папка: (.+)\. Резервная папка: (.+)\. Скопируют/);const existing=new Set(b.split(', '));return a.split(', ').filter(x=>!existing.has(x)).length;},
  'minimum-deletions':p=>{const[listed,targetText]=match(p,/размером ([\d, ]+) Кбайт\. Нужно освободить не менее (\d+)/);const sizes=numbers(listed),target=Number(targetText);let best=Infinity;for(let mask=0;mask<1<<sizes.length;mask++){let sum=0,count=0;for(let i=0;i<sizes.length;i++)if(mask>>i&1){sum+=sizes[i];count++;}if(sum>=target)best=Math.min(best,count);}return best;},

  'saved-value':p=>{const[a,b]=match(p,/x := (\d+); y := x; x := x \+ (\d+)/).map(Number);let x=a,y=x;x+=b;return y;},
  'division-remainder':p=>{const[start,step]=match(p,/с числа (\d+) и вычитает (\d+)/).map(Number);return start%step;},
  'maximum-three':p=>{const[listed]=match(p,/Даны числа ([\d, ]+)\./);return numbers(listed).sort((a,b)=>b-a)[0];},
  'robot-heading':p=>{const[start,countText]=match(p,/смотрит на (север|восток|юг|запад)\. Он (\d+) раз/);const next={север:'восток',восток:'юг',юг:'запад',запад:'север'};let position=start;for(let i=0;i<Number(countText);i++)position=next[position];return position;},
  'command-count':p=>{const[step,start,end]=numbers(p);let x=start,commands=0;while(x<end){x+=step;commands++;}assert.equal(x,end);return commands;},
  'repeated-multiply':p=>{const[start,factor,count]=numbers(p);let answer=start;for(let i=0;i<count;i++)answer*=factor;return answer;},
  'growing-additions':p=>{const[start]=numbers(p),[last]=match(p,/до (\d+) включительно/).map(Number);let answer=start;for(let i=1;i<=last;i++)answer+=i;return answer;},
  'alternating-actions':p=>{const[start,plus,minus]=numbers(p),[count]=match(p,/выполняют (\d+) команд/).map(Number);let answer=start;for(let i=0;i<count;i++)answer+=i%2===0?plus:-minus;return answer;},
  'until-bound':p=>{const[start,limit,step]=numbers(p);let answer=start;while(answer<limit)answer+=step;return answer;},
  'filter-list':p=>{const[listed]=match(p,/Список: ([\d, ]+)\./),[limit]=match(p,/больше (\d+) и чётные/).map(Number);return numbers(listed).reduce((count,x)=>count+(x%2===0&&x>limit?1:0),0);},
  'nested-repeat':p=>{const[start,inside,step,one,blocks]=numbers(p);assert.equal(one,1);let result=start;for(let b=0;b<blocks;b++){for(let i=0;i<inside;i++)result+=step;result--;}return result;},
  'reverse-sequence':p=>{const[plus,factor,minus,result]=numbers(p);const candidates=[];for(let x=-100;x<100;x++)if((x+plus)*factor-minus===result)candidates.push(x);assert.equal(candidates.length,1);return candidates[0];},
  'robot-distance':p=>{const[east,north,west,south]=numbers(p);let x=0,y=0;for(let i=0;i<east;i++)x++;for(let i=0;i<north;i++)y++;for(let i=0;i<west;i++)x--;for(let i=0;i<south;i++)y--;return Math.abs(x)+Math.abs(y);},
  'two-conditions':p=>{const[original,limit,plus]=numbers(p);let x=original;if(x<limit)x+=plus;if(x%2===0)x/=2;return x;},
  'shortest-program':p=>{const[target]=match(p,/получить (\d+)\?/).map(Number);let frontier=[1],depth=0;const seen=new Set([1]);while(!frontier.includes(target)){const next=[];for(const x of frontier)for(const y of[x+1,x*2])if(y<=target&&!seen.has(y)){seen.add(y);next.push(y);}assert.ok(next.length);frontier=next;depth++;}return depth;},
};

test('grade 7 adds 60 distinct concepts with 15 per topic and a 5/5/5 level balance',()=>{
  assert.equal(templates.length,60);assert.equal(new Set(templates.map(t=>t.id)).size,60);
  for(const topic of ['information','encoding','files','algorithms']){
    const group=templates.filter(t=>t.topicId===`g7-${topic}`);assert.equal(group.length,15);
    for(const level of ['basic','standard','advanced'])assert.equal(group.filter(t=>t.difficulty===level).length,5);
  }
  assert.equal(Object.keys(solvers).length,60);
});
test('grade 7 keys match independent solutions reconstructed from every generated condition',()=>{
  let checks=0;
  for(const template of templates){
    const key=template.id.split('-ext-')[1];assert.equal(typeof solvers[key],'function',key);
    for(const seed of [0,1,2,3,7,19,1430,2026,4294967295]){
      const q=template.build(random(seed));
      assert.equal(String(solvers[key](q.prompt)),q.answer,`${template.id} seed=${seed}\n${q.prompt}`);
      assert.ok(q.solutionSteps.length>=2&&q.solutionSteps.length<=5);
      assert.equal(new Set(q.solutionSteps).size,q.solutionSteps.length);
      assert.ok(q.solutionSteps.every(s=>s.length>=10));
      assert.ok(!q.solutionSteps.some(s=>/undefined|NaN|Infinity/.test(s)));
      assert.ok(!/логарифм/i.test(q.prompt+q.explanation));checks++;
    }
  }
  assert.equal(checks,540);
});
