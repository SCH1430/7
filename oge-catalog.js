(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./oge-core.js'):root.OGE1430);if(typeof module==='object'&&module.exports)module.exports=api;else root.OGECatalog1430=api;})(typeof globalThis!=='undefined'?globalThis:this,function(O){
  'use strict';
  const labels={start:'Разминка',standard:'По демоверсии',challenge:'Усложнённый'};
  const statusLabels={new:'Новое',solved:'Решено',wrong:'Была ошибка',pending:'Ожидает проверки'};
  const timeLimits=[0,10,20,30,45,60,90,150],maxTasks=100;
  const normalize=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е');
  const identified=student=>!!String(student?.name||'').trim()&&!!String(student?.schoolClass||'').trim();
  function history(input={}){
    const statuses={};if(!identified(input.student))return statuses;
    const who=O.studentIdentity(input.student.name,input.student.schoolClass),choice=input.choice13||'13.1';
    const attempts=(Array.isArray(input.attempts)?input.attempts:[]).filter(a=>a&&a.kind==='1430-oge-result'&&a.variantId===O.id&&Number.isFinite(a.finishedAt)&&a.finishedAt>=a.startedAt&&O.studentIdentity(a.name,a.schoolClass)===who).map((a,i)=>({a,i})).sort((x,y)=>x.a.finishedAt-y.a.finishedAt||y.i-x.i);
    for(const {a} of attempts){
      try{
        const valid=O.validate(a),scored=O.score(valid);
        scored.rows.forEach((r,index)=>{
          const id=r.task.bankId||valid.entries?.[index]||valid.taskIds?.[valid.taskNumbers[index]]||'oge-fipi-'+r.task.n,t=O.bankById(id);
          if(!t||t.n===13&&a.choice13!==choice)return;
          statuses[id]={status:r.pending?'pending':r.points===t.max?'solved':'wrong',finishedAt:a.finishedAt,points:r.points,max:t.max};
        });
      }catch{/* Damaged imports cannot assign progress to a valid task. */}
    }
    return statuses;
  }
  function rows(input={}){
    const statuses=history(input);
    return O.bank.map(t=>({...t,id:t.bankId,difficulty:t.difficulty||'standard',difficultyLabel:labels[t.difficulty||'standard'],topic:t.topic||'Задание №'+t.n,status:statuses[t.bankId]?.status||'new',statusLabel:statusLabels[statuses[t.bankId]?.status||'new']}));
  }
  function filter(input={}){
    const words=normalize(input.search).trim().split(/\s+/).filter(Boolean);
    return rows(input).filter(t=>(!input.difficulty||input.difficulty==='all'||t.difficulty===input.difficulty)&&(!input.number||input.number==='all'||t.n===Number(input.number))&&(!input.topic||input.topic==='all'||t.topic===input.topic)&&(!input.origin||input.origin==='all'||t.origin===input.origin)&&(!input.status||input.status==='all'||t.status===input.status)&&words.every(w=>normalize([t.id,t.title,t.topic,t.n,t.difficultyLabel,t.difficultyReason||'',t.body.replace(/<[^>]*>/g,' ')].join(' ')).includes(w)));
  }
  function availability(input={}){
    const candidates=filter(input),personal=identified(input.student),progress=personal?O.studentProgress({...input.student,choice13:input.choice13,attempts:input.attempts||[]}):null;
    const available=candidates.filter(t=>!progress||progress.byNumber[t.n].availableIds.includes(t.id));
    return {rows:candidates,total:candidates.length,numberCount:new Set(candidates.map(t=>t.n)).size,availableCount:available.length,availableIds:available.map(t=>t.id),maxCount:Math.min(maxTasks,available.length),personal,bankCycle:progress?.bankCycle||1};
  }
  function validateDraft(input){
    if(!input||!Array.isArray(input.taskIds)||input.taskIds.length>maxTasks||!['13.1','13.2'].includes(input.choice13))throw Error('Неверная подборка ОГЭ: до 100 условий и формат №13.');
    const timeLimitMinutes=input.timeLimitMinutes===undefined?20:input.timeLimitMinutes;
    if(!timeLimits.includes(timeLimitMinutes))throw Error('Выбери длительность тренировки или режим без таймера.');
    const seen=new Set(),ids=[];
    for(const id of input.taskIds){if(typeof id!=='string'||!O.bankById(id))throw Error('В подборке есть неизвестное задание ОГЭ.');if(seen.has(id))throw Error('Одно и то же условие нельзя добавить дважды. Выбери другую версию этого номера.');seen.add(id);ids.push(id);}
    return {taskIds:ids,choice13:input.choice13,automatic:input.automatic===true,timeLimitMinutes};
  }
  function toggle(input,id,checked){
    const draft=validateDraft(input);if(!O.bankById(id))throw Error('Задание не найдено.');
    if(!checked)draft.taskIds=draft.taskIds.filter(x=>x!==id);else if(!draft.taskIds.includes(id)){if(draft.taskIds.length===maxTasks)throw Error('В одной тренировке может быть до 100 условий.');draft.taskIds.push(id);}
    draft.automatic=false;return draft;
  }
  function selection(input,student={},attempts=[]){
    const draft=validateDraft(input);if(!draft.taskIds.length)throw Error('Выбери хотя бы одно условие ОГЭ.');
    const name=String(student.name||'').trim(),schoolClass=String(student.schoolClass||'').trim();
    if(name.length<2||name.length>100||!schoolClass||schoolClass.length>20)throw Error('Укажи фамилию, имя и класс.');
    const p=O.studentProgress({name,schoolClass,choice13:draft.choice13,attempts});
    if(draft.automatic&&draft.taskIds.some(id=>!p.byNumber[O.bankById(id).n].availableIds.includes(id)))throw Error('Подборка уже встречалась в завершённой попытке. Собери новую подборку.');
    const taskNumbers=draft.taskIds.map((_,i)=>i+1);
    return {schema:2,mode:'practice',entries:[...draft.taskIds],taskNumbers,taskIds:Object.fromEntries(taskNumbers.map((slot,i)=>[slot,draft.taskIds[i]])),selectionMode:O.selectionMode,bankCycle:p.bankCycle,timeLimitMinutes:draft.timeLimitMinutes,name,schoolClass,choice13:draft.choice13};
  }
  function auto(input={},rng=Math.random){
    const count=Number(input.count);if(!Number.isInteger(count)||count<1||count>maxTasks)throw Error('Количество условий: от 1 до 100.');
    const draft=validateDraft({taskIds:[],choice13:input.choice13===undefined?'13.1':input.choice13,timeLimitMinutes:input.timeLimitMinutes,automatic:true});
    const info=availability({...input,choice13:draft.choice13});
    if(info.availableCount<count)throw Error('По этим фильтрам доступно '+info.availableCount+' условий'+(info.personal?' без повторов в текущем круге':'')+'. Уменьши количество или измени фильтры.');
    const random=length=>{const v=Number(rng());if(!Number.isFinite(v)||v<0||v>=1)throw Error('Неверное значение генератора.');return Math.floor(v*length);};
    const pools=new Map();for(const id of info.availableIds){const n=O.bankById(id).n;if(!pools.has(n))pools.set(n,[]);pools.get(n).push(id);}
    const taskIds=[];
    while(taskIds.length<count){
      const numbers=[...pools.keys()];
      for(let i=numbers.length-1;i>0;i--){const j=random(i+1);[numbers[i],numbers[j]]=[numbers[j],numbers[i]];}
      for(const n of numbers){if(taskIds.length===count)break;const set=pools.get(n),index=random(set.length);taskIds.push(set.splice(index,1)[0]);if(!set.length)pools.delete(n);}
    }
    taskIds.sort((a,b)=>O.bankById(a).n-O.bankById(b).n);
    return {...draft,taskIds};
  }
  function retry(attempt,kind,attempts=[],rng=Math.random){
    if(!['exact','analogue'].includes(kind))throw Error('Выбери повтор условия или новый аналог.');
    const a=O.validate(attempt),scored=O.score(a),errors=scored.rows.filter(r=>r.pending||r.points<r.task.max),selected=errors.length?errors:scored.rows;
    const ids=selected.map(r=>r.task.bankId||a.taskIds?.[r.slot??r.task.n]||'oge-fipi-'+r.task.n);
    const result=validateDraft({taskIds:ids,choice13:a.choice13,timeLimitMinutes:a.schema===2?a.timeLimitMinutes:20,automatic:false});
    if(kind==='exact')return result;
    const progress=O.studentProgress({name:a.name,schoolClass:a.schoolClass,choice13:a.choice13,attempts:[...attempts,a]}),used=new Set(ids),picked=[];
    for(const id of ids){
      const t=O.bankById(id),difficulty=t.difficulty||'standard';
      const candidates=progress.byNumber[t.n].availableIds.filter(next=>!used.has(next)&&(O.bankById(next).difficulty||'standard')===difficulty);
      if(!candidates.length)throw Error('Для №'+t.n+' уровня «'+labels[difficulty]+'» не осталось новых условий. Повтори исходные условия или собери другую тренировку.');
      const random=Number(rng());if(!Number.isFinite(random)||random<0||random>=1)throw Error('Неверное значение генератора.');
      const next=candidates[Math.floor(random*candidates.length)];picked.push(next);used.add(next);
    }
    return {...result,taskIds:picked,automatic:true};
  }
  return {labels,statusLabels,timeLimits,maxTasks,rows,filter,history,availability,validateDraft,toggle,selection,auto,retry};
});
