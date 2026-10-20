import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerMoreGrade7} from '../js/bank-more-grade7.js';
import {TEMPLATE_CATALOG,generateQuestions} from '../js/bank.js';

const templates=[];
registerMoreGrade7({
  add:(topicId,key,title,difficulty,difficultyReason,build)=>templates.push({id:`${topicId}-${key}`,key:key.slice(5),topicId,title,difficulty,difficultyReason,build}),
  numeric:(prompt,answer,explanation)=>({kind:'number',prompt,answer:String(answer),explanation,points:1}),
  textual:(prompt,answer,explanation)=>({kind:'text',prompt,answer:String(answer),explanation,points:1}),
});
const nums=s=>(s.match(/-?\d+/g)||[]).map(Number);
const match=(p,re)=>{const m=p.match(re);assert.ok(m,`Не разобрано условие: ${re}: ${p}`);return m.slice(1);};
const sum=a=>a.reduce((s,n)=>s+n,0);
const bits=s=>[...s].map(Number);
const words=s=>s.split(', ');
const prefix=(p,re)=>nums(match(p,re)[0]);
const solvers={
  'byte-tail':p=>{const[a,b]=nums(p);return sum(Array(a).fill(8))+b;},
  'edit-message':p=>{const[a,b,c,d]=nums(p);return Array(a-b+c).fill(d).reduce((s,x)=>s+x,0);},
  'timed-readings':p=>{const[b,step,time]=nums(p);let total=0;for(let second=0;second<=time;second+=step)total+=b;return total;},
  'header-quarter':p=>{const[total,,d]=nums(p);return total/d*(d-1);},
  'bits-per-second':p=>{const[size,rate]=nums(p);let seconds=0,remaining=size*8;while(remaining>0){remaining-=rate;seconds++;}return seconds;},
  'mean-record':p=>sum(prefix(p,/занимают ([\d, ]+) байт/))/3,
  'kib-rest':p=>{const[size]=nums(p);let count=0,left=size;while(left>=1024){left-=1024;count++;}return count;},
  'mixed-encoding':p=>{const[a,b,h]=match(p,/В файле (\d+) букв по 2 байта и (\d+) цифр по 1 байту\. Общий заголовок занимает ещё (\d+)/).map(Number);return a+a+b+h;},
  'line-separators':p=>{const[rows,len,separator]=match(p,/из (\d+) строк по (\d+) символов\..*разделитель из (\d+) байт/).map(Number);let size=0;for(let row=0;row<rows;row++){size+=len;if(row)size+=separator;}return size;},
  'whole-seconds':p=>{const[size,speed]=nums(p);let time=0;while(time*speed<size)time++;return time;},
  'meter-difference':p=>{const[first,seconds,last]=nums(p);return (last-first)/seconds;},
  'missing-record':p=>{const[mean,first,second]=nums(p);return mean+mean+mean-first-second;},
  'percent-growth':p=>{const[before,percent]=nums(p);return before+percent*(before/100);},
  'average-rate':p=>{const[size,a,b]=nums(p);return (size+size)/(a+b);},
  'time-budget':p=>{const[send,pause,total]=nums(p);let n=0,t=0;while(t+(n?pause:0)+send<=total){t+=(n?pause:0)+send;n++;}return n;},
  'retry-packets':p=>{const[count,size,header,retries]=nums(p);let total=0;for(let i=0;i<count+retries;i++)total+=size+header;return total;},
  'ring-journal':p=>{const[cap]=nums(p),[count]=match(p,/Создано (\d+) записей/).map(Number),queue=[];for(let i=1;i<=count;i++){queue.push(i);if(queue.length>cap)queue.shift();}return queue[0];},
  'alternating-channel':p=>{const[slot,chunks]=nums(p);let time=0,sentB=0,turn='А';while(sentB<chunks){time+=slot;if(turn==='Б')sentB++;turn=turn==='А'?'Б':'А';}return time;},
  'compression-time':p=>{const[size,speed,compression,packed]=nums(p);return size/speed-(compression+packed/speed);},
  'shared-byte-packing':p=>{const[count,width]=nums(p);let one=0;while(one*8<width)one++;let shared=0;while(shared*8<count*width)shared++;return one*count-shared;},

  'invert-bits':p=>{const[s]=match(p,/строку ([01]+):/);return s.replace(/[01]/g,b=>String(1-Number(b)));},
  'changed-bits':p=>{const[a,b]=match(p,/строки ([01]+) и ([01]+)\./);return bits(a).reduce((s,x,i)=>s+(x!==Number(b[i])?1:0),0);},
  'mirror-row':p=>{const[s]=match(p,/как ([01]+)\./);let out='';for(const ch of s)out=ch+out;return out;},
  'both-masks':p=>{const[a,b]=match(p,/маски ([01]+) и ([01]+)\./);return bits(a).map((n,i)=>n*Number(b[i])).join('');},
  'crop-row':p=>{const[s,start,end]=match(p,/пикселей: ([01]+)\..*позиции от (\d+) до (\d+)/);let count=0;for(let i=Number(start);i<=Number(end);i++)count+=Number(s[i-1]);return count;},
  'ternary-lamps':p=>{const[count]=nums(p);let combinations=[''];for(let i=0;i<count;i++)combinations=combinations.flatMap(s=>['К','Ж','З'].map(c=>s+c));return combinations.length;},
  'count-coded-letter':p=>{const[s]=match(p,/Сообщение: ([01]+)\./),[letter]=match(p,/буква ([АБВГ])\?/);const decoded=s.match(/../g).map(pair=>'АБВГ'[Number.parseInt(pair,2)]);return decoded.filter(c=>c===letter).length;},
  'restore-runs':p=>{const[a,b,c]=nums(p);return Array(a).fill('0').concat(Array(b).fill('1'),Array(c).fill('0')).join('');},
  'count-runs':p=>{const[s]=match(p,/Строку ([01]+) сжимают/);let count=1;for(let i=1;i<s.length;i++)if(s[i]!==s[i-1])count++;return count;},
  'cyclic-shift':p=>{const[s,k]=match(p,/строки ([01]+) вправо на (\d+)/),array=[...s];for(let i=0;i<Number(k);i++)array.unshift(array.pop());return array.join('');},
  'parity-packets':p=>{const[list]=match(p,/пакеты: ([01, ]+)\./);return words(list).filter(s=>bits(s).reduce((a,b)=>a^b,0)===1).length;},
  'coordinate-encode':p=>{const[s]=match(p,/слово ([АБВГДЕЖЗИ]+):/),table=[['А','Б','В'],['Г','Д','Е'],['Ж','З','И']];return [...s].map(ch=>{for(let row=0;row<3;row++)for(let col=0;col<3;col++)if(table[row][col]===ch)return`${row+1}${col+1}`;}).join('');},
  'image-border':p=>{const[w,h]=match(p,/ширину (\d+) пикселей и высоту (\d+) пикселей/).map(Number);let count=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||x===w-1||y===0||y===h-1)count++;return count;},
  'separate-channels':p=>{const[s]=match(p,/строке ([01]+) биты/);let out='';for(let i=1;i<s.length;i+=2)out+=s[i];return out;},
  'scale-pixels':p=>{const[count,w,h]=nums(p);let black=0;for(let i=0;i<count;i++)for(let y=0;y<h;y++)for(let x=0;x<w;x++)black++;return black;},
  'overlay-rows':p=>{const[a,b]=match(p,/плёнки: ([01]+) и ([01]+)\./);const marked=new Set();for(const row of [a,b])for(let i=0;i<row.length;i++)if(row[i]==='1')marked.add(i);return marked.size;},
  'prefix-decode':p=>{const[encoded]=match(p,/Расшифруйте ([01]+)\./),table={'0':'А','10':'Б','110':'В','111':'Г'};let buffer='',answer='';for(const bit of encoded){buffer+=bit;if(table[buffer]){answer+=table[buffer];buffer='';}}assert.equal(buffer,'');return answer;},
  'parity-location':p=>{const[listed,rowText,colText]=match(p,/сверху вниз: ([01, ]+)\. Исходная чётность строк: ([01]+); исходная чётность столбцов: ([01]+)\./),grid=words(listed).map(bits),rows=[],cols=[];for(let i=0;i<grid.length;i++){if((sum(grid[i])%2)!==Number(rowText[i]))rows.push(i+1);if(grid.reduce((s,r)=>s^r[i],0)!==Number(colText[i]))cols.push(i+1);}assert.equal(rows.length,1);assert.equal(cols.length,1);return`${rows[0]}${cols[0]}`;},
  'reverse-substitution':p=>{const[s]=match(p,/Слово ([АБВГД]+) шифруют/),map={А:'В',Б:'Г',В:'Д',Г:'А',Д:'Б'};let result='';for(const c of s)result=map[c]+result;return result;},
  'palette-row-fit':p=>{const[w,h,colors]=match(p,/имеет (\d+) пикселей в строке и (\d+) строк\. Используются (\d+)/).map(Number);let width=0,codes=1;while(codes<colors){width++;codes*=2;}let rowBytes=0;for(let bit=0;bit<w*width;bit+=8)rowBytes++;return h*rowBytes;},

  'name-order':p=>{const[list,k]=match(p,/Имена: (.+)\. Сортировка.*месте (\d+) при/);return words(list).sort()[Number(k)-1];},
  'name-and-extension':p=>{const[list]=match(p,/файлы: (.+)\. Сколько имён/);return words(list).filter(s=>s.slice(0,3)==='lab'&&s.slice(s.lastIndexOf('.')+1)==='txt').length;},
  'copy-rounds':p=>{const[count,rounds]=nums(p);let files=Array(count).fill(0);for(let round=0;round<rounds;round++)files=[...files,...files];return files.length;},
  'folder-tree':p=>{const[branches,leaves]=nums(p);let folders=['Проект'];for(let i=0;i<branches;i++){folders.push(`ветка${i}`);for(let j=0;j<leaves;j++)folders.push(`ветка${i}/лист${j}`);}return folders.length;},
  'size-rank':p=>{const[list,k]=match(p,/файлов: ([\d, ]+) Кбайт\..*месте (\d+)\?/);const sorted=nums(list);for(let i=1;i<sorted.length;i++)for(let j=i;j>0&&sorted[j-1]>sorted[j];j--)[sorted[j-1],sorted[j]]=[sorted[j],sorted[j-1]];return sorted[Number(k)-1];},
  'recycle-space':p=>sum(nums(p).slice(0,3)),
  'path-length':p=>match(p,/Полный путь: ([/\w.]+)\./)[0].split('').length,
  'rename-parent':p=>{const[path]=match(p,/путь ([/\w.]+)\./),[name]=match(p,/переименовали в (\w+)\./),segments=path.split('/');segments[2]=name;return segments.join('/');},
  'wildcard-star':p=>{const[list]=match(p,/Файлы: (.+?)\. Маска a/);return words(list).filter(file=>/^a..*\.txt$/.test(file)).length;},
  'common-names':p=>{const[a,b]=match(p,/Папка А: (.+)\. Папка Б: (.+)\. Сколько/);return [...new Set(words(a))].filter(name=>new Set(words(b)).has(name)).length;},
  'replace-table':p=>{const[,b,,newA,newC]=match(p,/a.txt занимает (\d+) Кбайт, b.txt — (\d+) Кбайт, c.txt — (\d+) Кбайт\..*размером (\d+) и (\d+) Кбайт/).map(Number);return b+newA+newC;},
  'last-volume':p=>{const[size,cap]=nums(p);let left=size;while(left>cap)left-=cap;return left;},
  'two-key-sort':p=>{const[list,k]=match(p,/размеры: (.+)\. Сначала.*месте (\d+)\?/),files=[...list.matchAll(/([a-d]\.txt) — (\d+) Кбайт/g)].map(m=>[m[1],Number(m[2])]);return files.sort((a,b)=>a[1]-b[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0))[Number(k)-1][0];},
  'incremental-backup':p=>{const[list,changed]=match(p,/Размеры файлов: (.+)\. Изменились только (.+)\. В новую/),sizes=new Map([...list.matchAll(/([a-e]\.txt) — (\d+) Кбайт/g)].map(m=>[m[1],Number(m[2])]));return sum(words(changed).map(name=>sizes.get(name)));},
  'peak-space':p=>{const[,fresh]=nums(p);return fresh;},
  'mirror-sync':p=>{const[a,b]=match(p,/Образец: (.+)\. Копия: (.+)\. Нужно/),desired=new Set(words(a)),existing=new Set(words(b));let steps=0;for(const file of existing)if(!desired.has(file))steps++;for(const file of desired)if(!existing.has(file))steps++;return steps;},
  'maximum-files':p=>{const[list,capacity]=match(p,/Размеры файлов: ([\d, ]+) Мбайт\. Свободно (\d+) Мбайт/),sizes=nums(list);let best=0;for(let mask=0;mask<1<<sizes.length;mask++){let total=0,count=0;for(let i=0;i<sizes.length;i++)if(mask>>i&1){total+=sizes[i];count++;}if(total<=Number(capacity))best=Math.max(best,count);}return best;},
  'relative-target':p=>{const[current,target]=match(p,/Текущая папка ([/\w]+)\. Нужен файл ([/\w.]+)\./),a=current.split('/').filter(Boolean),b=target.split('/').filter(Boolean);while(a.length&&b.length&&a[0]===b[0]){a.shift();b.shift();}return [...a.map(()=>'..'),...b].join('/');},
  'undo-history':p=>{const[a,b,c]=match(p,/создали (\w+\.txt), затем скопировали его как (\w+\.txt), затем переименовали (?:\w+\.txt) в (\w+\.txt)\./),files=new Set([a,c]);files.delete(c);files.add(b);files.delete(b);return [...files].join('');},
  'nested-extraction':p=>{const[archives,ordinary,inside]=nums(p);return 1+archives+ordinary+sum(Array(archives).fill(inside));},

  'swap-values':p=>{const[a,b]=match(p,/a = (\d+), b = (\d+)/).map(Number);let left=a,right=b,temp=left;left=right;right=temp;return`${left} ${right}`;},
  'three-branches':p=>{const[x,lo,hi]=match(p,/x = (\d+)\. Если x < (\d+), вывести 1\. Иначе, если x ≤ (\d+)/).map(Number);const states=[[x<lo,1],[x>=lo&&x<=hi,2],[x>hi,3]];return states.find(s=>s[0])[1];},
  'whole-groups':p=>{const[amount,box]=nums(p);let left=amount,closed=0;while(left>=box){left-=box;closed++;}return closed;},
  'replace-element':p=>{const[list,k,v]=match(p,/Список: ([\d, ]+)\. Элемент с номером (\d+) заменили числом (\d+)/),a=nums(list);a.splice(Number(k)-1,1,Number(v));return sum(a);},
  'neutral-commands':p=>{const[start]=nums(p),[up]=match(p,/прибавить (\d+);/).map(Number);const transitions=[x=>x+up,x=>x*1,x=>x+0,x=>x-up,x=>x*1];let x=start,changed=0;for(const fn of transitions){const next=fn(x);if(next!==x)changed++;x=next;}return changed;},
  'string-assignment':p=>{const[a,b]=match(p,/a = «([АБВГД]+)», b = «([АБВГД]+)»/);return [...a,...b].join('');},
  'inclusive-filter':p=>{const[list,lo,hi]=match(p,/числа ([\d, ]+)\..*x ≥ (\d+) и x ≤ (\d+)/);return nums(list).filter(x=>!(x<Number(lo)||x>Number(hi))).length;},
  'record-maxima':p=>{const values=prefix(p,/Числа: ([\d, ]+)\./);let updates=0;for(let i=1;i<values.length;i++)if(values.slice(0,i).every(v=>values[i]>v))updates++;return updates;},
  'descending-loop':p=>{const[start,limit,step]=nums(p);return Math.ceil((start-limit)/step);},
  'sentinel-sum':p=>{const a=prefix(p,/числа ([\d, ]+)\./),stop=a.indexOf(0);return sum(a.slice(0,stop));},
  'integer-halving':p=>{const[start]=nums(p);let width=1;while(2**width<=start)width++;return width-1;},
  'first-divisor':p=>{const[n]=nums(p);const candidates=Array.from({length:n-1},(_,i)=>i+2);return candidates.findIndex(d=>n%d===0)+1;},
  'blocked-steps':p=>{const[max,start,commands]=match(p,/от 0 до (\d+)\. Стартовая клетка (\d+)\..*Выполните ([ПЛ]+)\./);let x=Number(start);for(const c of commands)x=c==='П'?Math.min(Number(max),x+1):Math.max(0,x-1);return x;},
  'sum-by-position':p=>{const a=prefix(p,/Список: ([\d, ]+)\./);let result=0;for(const index of [2,5,8])result+=a[index];return result;},
  'updated-comparison':p=>{const[a,b,inc]=match(p,/a = (\d+), b = (\d+)\..*увеличить b на (\d+)/).map(Number);let x=a,y=b;if(x<y)[x,y]=[y,x];if(x>y)y+=inc;return y;},
  'state-cycle':p=>{const[start,steps]=match(p,/состоянии ([АБВ])\..*Выполнили (\d+) команд/),next={А:'Б',Б:'В',В:'А'};let state=start;for(let i=0;i<Number(steps);i++)state=next[state];return state;},
  'count-programs':p=>{const[target]=match(p,/к числу (\d+)\?/).map(Number);let ways=0;function enumerate(value){if(value===target){ways++;return;}if(value>target)return;enumerate(value+1);enumerate(value+2);}enumerate(0);return ways;},
  'barrier-route':p=>{const[goal,blocked]=match(p,/в \((\d+), 0\)\..*Клетка \((\d+), 0\) запрещена/).map(Number);const queue=[[0,0,0]],visited=new Set(['0,0']);for(let index=0;index<queue.length;index++){const[x,y,d]=queue[index];if(x===goal&&y===0)return d;for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;if(nx<0||nx>goal||Math.abs(ny)>1||(nx===blocked&&ny===0)||visited.has(key))continue;visited.add(key);queue.push([nx,ny,d+1]);}}throw new Error('No route');},
  'search-midpoint':p=>{const[list,needle]=match(p,/возрастанию: ([\d, ]+)\. Ищут число (\d+)\./);let remaining=nums(list),count=0;while(remaining.length){const index=Math.floor((remaining.length-1)/2),value=remaining[index];count++;if(value===Number(needle))return count;remaining=value<Number(needle)?remaining.slice(index+1):remaining.slice(0,index);}throw new Error('Not found');},
  'branch-loop':p=>{const[start,count]=nums(p);let x=start;for(let i=0;i<count;i++)x=Number.isInteger(x/2)?x/2:x+3;return x;},
};

function random(seed) {
  let x=seed>>>0;
  const r=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  r.int=(a,b)=>{assert.ok(Number.isInteger(a)&&Number.isInteger(b)&&a<=b);return a+Math.floor(r()*(b-a+1));};
  r.pick=a=>a[r.int(0,a.length-1)];r.array=(n,a,b)=>Array.from({length:n},()=>r.int(a,b));return r;
}
function boundary(high){const r=()=>high?0.999999:0;r.int=(a,b)=>{assert.ok(a<=b);return high?b:a;};r.pick=a=>a[high?a.length-1:0];r.array=(n,a,b)=>Array(n).fill(high?b:a);return r;}
function verify(template,q) {
  assert.ok(q.prompt.length>45,template.id);
  assert.ok(!/undefined|NaN|Infinity/.test(q.prompt+' '+q.answer+' '+q.explanation),template.id);
  assert.ok(Array.isArray(q.solutionSteps)&&q.solutionSteps.length>=2,template.id);
  assert.ok(q.solutionSteps.every(s=>typeof s==='string'&&s.length>=10),template.id);
  assert.ok(new Set(q.solutionSteps).size>=2,template.id);
  assert.equal(String(solvers[template.key](q.prompt)),q.answer,template.id+'\n'+q.prompt);
}

test('grade7 second expansion has exactly80 distinct types and7/7/6 in each topic',()=>{
  assert.equal(templates.length,80);assert.equal(new Set(templates.map(t=>t.id)).size,80);
  assert.deepEqual(Object.keys(solvers).sort(),templates.map(t=>t.key).sort());
  for(const topic of ['information','encoding','files','algorithms']){
    const selected=templates.filter(t=>t.topicId===`g7-${topic}`);assert.equal(selected.length,20);
    assert.deepEqual(['basic','standard','advanced'].map(level=>selected.filter(t=>t.difficulty===level).length),[7,7,6]);
  }
  assert.equal(TEMPLATE_CATALOG.filter(t=>t.grade===7&&t.id.includes('-plus-')).length,80);
});

test('grade7 second expansion: independent answers from wording across random and boundary inputs',()=>{
  let checked=0;
  for(const template of templates){
    for(let seed=1;seed<=30;seed++){verify(template,template.build(random(seed*7919)));checked++;}
    for(const high of [false,true]){verify(template,template.build(boundary(high)));checked++;}
  }
  assert.equal(checked,2560);
});

test('grade7 second expansion: integrated generation remains deterministic and varies task data',()=>{
  for(const template of templates){
    const seen=new Set();
    for(const variant of [1,2,7,18,30]){
      const config={grade:7,templateIds:[template.id],seed:1430,variant},q=generateQuestions(config)[0];
      verify(template,q);seen.add(q.prompt);assert.deepEqual(q,generateQuestions(config)[0]);
    }
    assert.ok(seen.size>1,template.id+' has no varying task data');
  }
});
