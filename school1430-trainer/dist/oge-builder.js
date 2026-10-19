(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  root.OGEBuilder1430={create({O,K,layout,read,write,toast,isActive,results,onStart}){
    const storage='1430.oge.v1.builder',pageSize=24,defaults=()=>({difficulty:'all',number:'all',topic:'all',origin:'all',status:'all',search:''});
    let draft={taskIds:[],choice13:'13.1',automatic:false,timeLimitMinutes:20},filters=defaults(),page=1,autoCount='5',name='',schoolClass='',profileTouched=false,searchTimer,profileTimer;
    try{draft=K.validateDraft(read(storage,draft));}catch{toast('Подборка ОГЭ повреждена. Можно собрать новую.');}
    const latest=read('1430.oge.v1.active',null)||results()[0];name=latest?.name||'';schoolClass=latest?.schoolClass||'';
    const save=()=>write(storage,draft),student=()=>({name,schoolClass}),input=()=>({...filters,student:student(),attempts:results(),choice13:draft.choice13});
    function badge(t,personal){return '<div class="oge-level-badges"><span class="oge-level-'+t.difficulty+'">'+esc(K.labels[t.difficulty])+'</span><span>≈ '+t.estimatedMinutes+' мин</span><span>'+(t.origin==='fipi'?'Оригинал ФИПИ':'Авторское учебное задание')+'</span>'+(personal?'<span class="oge-task-status oge-status-'+t.status+'">'+esc(t.statusLabel)+'</span>':'')+'</div>';}
    function snippet(t){const el=document.createElement('div');el.innerHTML=t.body;const text=el.textContent.replace(/\s+/g,' ').trim();return text.length>210?text.slice(0,207).replace(/\s+\S*$/,'')+'…':text;}
    function pager(total){
      const pages=Math.max(1,Math.ceil(total/pageSize));
      return '<nav class="bank-pagination" aria-label="Страницы банка ОГЭ"><span>'+(total?((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,total):'0')+' из '+total+'</span><div><button class="tool-button" data-oge-builder-action="page" data-page="'+(page-1)+'" '+(page===1?'disabled':'')+' aria-label="Предыдущая страница">←</button><label><span class="visually-hidden">Страница банка ОГЭ</span><select class="matching-select" data-oge-page>'+Array.from({length:pages},(_,i)=>'<option value="'+(i+1)+'" '+(page===i+1?'selected':'')+'>'+(i+1)+' / '+pages+'</option>').join('')+'</select></label><button class="tool-button" data-oge-builder-action="page" data-page="'+(page+1)+'" '+(page===pages?'disabled':'')+' aria-label="Следующая страница">→</button></div></nav>';
    }
    function preview(t){
      const imgs=t.origin==='fipi'?(t.n===13?['task-'+draft.choice13+'-1.png','task-'+draft.choice13+'-2.png']:t.images||[]):[];
      return '<details class="builder-preview"><summary>Посмотреть полное условие</summary><p class="oge-level-reason">'+esc(t.difficultyReason)+'</p><div class="task-body">'+t.body+'</div>'+(imgs.length?'<details class="oge-original"><summary>Исходное условие ФИПИ</summary>'+imgs.map(file=>'<a href="'+esc((t.asset||O.asset)+file)+'" target="_blank" rel="noopener"><img class="oge-task-image" loading="lazy" src="'+esc((t.asset||O.asset)+file)+'" alt="Исходное условие №'+t.n+'"></a>').join('')+'</details>':'')+(t.download?'<p class="oge-preview-file"><a href="'+esc((t.asset||O.asset)+t.download)+'" download>↓ '+esc(t.downloadLabel||'Материалы задания')+'</a></p>':'')+'</details>';
    }
    function autoError(info){
      if(!info.maxCount)return info.personal?'По этим фильтрам нет непройденных условий. Для повторения отметь задания вручную или измени фильтры.':'По этим фильтрам нет условий для автоподбора.';
      const count=Number(autoCount);
      if(!Number.isInteger(count)||count<1)return 'Укажи количество условий от 1 до '+info.maxCount+'.';
      if(count>info.maxCount)return 'Сейчас можно выбрать до '+info.maxCount+' условий по этим фильтрам.';
      return '';
    }
    function render(){
      if(isActive())return;
      const lastResult=results()[0];if(!profileTouched){if(!name)name=lastResult?.name||'';if(!schoolClass)schoolClass=lastResult?.schoolClass||'';}
      const info=K.availability(input()),rows=info.rows;page=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
      const cards=rows.slice((page-1)*pageSize,page*pageSize),allRows=K.rows(),topics=[...new Set(allRows.map(t=>t.topic))],selected=draft.taskIds.map(id=>O.bankById(id)),minutes=selected.reduce((sum,t)=>sum+t.estimatedMinutes,0),autoMessage=autoError(info);
      layout('<section id="oge-builder"><nav class="builder-route-tabs" aria-label="Банк для тренировки"><a href="index.html#builder">7 класс</a><span aria-current="page">ОГЭ · 9 класс</span></nav><div class="title-row"><div><div class="eyebrow">БАНК ОГЭ / ПО ДЕМО ИЗ ПРОЕКТА</div><h1 class="page-title">Собери свою тренировку.</h1><p class="page-description">'+O.bank.length+' условий ОГЭ. Выбирай тему, уровень и несколько версий одного номера — до '+K.maxTasks+' условий в своей тренировке.</p></div><div class="actions"><button class="btn btn-secondary" data-oge-builder-action="import">Загрузить подборку</button></div></div>'+
        '<p class="oge-level-explainer">Уровни — учебная классификация тренажёра: '+Object.entries(K.labels).map(([level,label])=>esc(label)+' — '+allRows.filter(t=>t.difficulty===level).length).join(' · ')+'. В карточках показано, чем отличается сложность.</p>'+
        '<form id="oge-builder-start" class="oge-builder-profile"><div><strong>Для кого эта тренировка?</strong><p>Укажи те же имя и класс: увидишь историю условий, а автоподбор исключит уже встречавшиеся в текущем круге.</p></div><label><span class="label">Фамилия и имя</span><input class="text-input" name="student" required minlength="2" maxlength="100" autocomplete="name" value="'+esc(name)+'" placeholder="Фамилия и имя"></label><label><span class="label">Класс</span><input class="text-input" name="schoolClass" required maxlength="20" value="'+esc(schoolClass)+'" placeholder="9 А"></label><button type="submit" class="btn btn-primary" '+(!selected.length?'disabled':'')+'>Начать тренировку →</button><p id="oge-builder-start-error" role="alert"></p><p class="oge-profile-status" role="status">'+(info.personal?'История: '+esc(name.trim())+' · '+esc(schoolClass.trim())+'. Статус условия — по последней завершённой попытке в этом браузере.':'Статусы появятся после ввода имени и класса. Выбирать условия можно уже сейчас.')+'</p></form>'+
        '<div class="builder-layout"><section class="builder-bank"><div class="builder-filters">'+
        '<label><span class="label">Сложность</span><select class="matching-select" data-oge-filter="difficulty"><option value="all">Все уровни</option>'+Object.entries(K.labels).map(([v,label])=>'<option value="'+v+'" '+(filters.difficulty===v?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
        '<label><span class="label">Номер ОГЭ</span><select class="matching-select" data-oge-filter="number"><option value="all">Все номера</option>'+O.tasks.map(t=>'<option value="'+t.n+'" '+(String(filters.number)===String(t.n)?'selected':'')+'>№'+t.n+' · '+esc(t.title)+'</option>').join('')+'</select></label>'+
        '<label><span class="label">Тема</span><select class="matching-select" data-oge-filter="topic"><option value="all">Все темы</option>'+topics.map(t=>'<option value="'+esc(t)+'" '+(filters.topic===t?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'+
        '<label><span class="label">Источник</span><select class="matching-select" data-oge-filter="origin"><option value="all">Весь банк</option><option value="fipi" '+(filters.origin==='fipi'?'selected':'')+'>Оригиналы демоверсии</option><option value="authored" '+(filters.origin==='authored'?'selected':'')+'>Авторские учебные задания</option></select></label>'+
        '<label><span class="label">Мой результат</span><select class="matching-select" data-oge-filter="status" '+(!info.personal?'disabled':'')+'><option value="all">Все условия</option>'+Object.entries(K.statusLabels).map(([v,label])=>'<option value="'+v+'" '+(filters.status===v?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
        '<label class="builder-search"><span class="label">Найти задание</span><input class="text-input" id="oge-builder-search" type="search" data-oge-filter="search" value="'+esc(filters.search)+'" placeholder="Тема, название, текст или ID"></label></div>'+
        '<form id="oge-builder-auto" class="oge-builder-auto"><label><span class="label">Условий в подборке</span><input class="text-input" name="count" aria-label="Количество заданий ОГЭ" type="number" value="'+esc(autoCount)+'" min="1" max="'+Math.max(1,info.maxCount)+'" required '+(!info.maxCount?'disabled':'')+'></label><button class="btn btn-secondary" '+(autoMessage?'disabled':'')+'>Подобрать автоматически</button><p class="oge-auto-availability">'+(info.personal?'Доступно без повторов в текущем круге: '+info.availableCount:'Доступно по фильтрам: '+info.availableCount)+'. В одной тренировке — до '+info.maxCount+' условий.</p><p id="oge-builder-auto-error" role="alert">'+esc(autoMessage)+'</p></form>'+
        '<div class="builder-bank-tools"><span role="status" data-oge-count>Найдено '+rows.length+' условий / '+info.numberCount+' номеров из '+O.bank.length+' условий банка</span><button data-oge-builder-action="reset">Сбросить фильтры</button></div>'+pager(rows.length)+
        '<div class="builder-task-list">'+(cards.length?cards.map(t=>'<article class="builder-task '+(draft.taskIds.includes(t.bankId)?'selected':'')+'"><label class="builder-task-label"><input type="checkbox" data-oge-task="'+t.bankId+'" '+(draft.taskIds.includes(t.bankId)?'checked':'')+' aria-label="№'+t.n+'. '+esc(t.title)+'. '+esc(K.labels[t.difficulty])+'"><span><small>№'+t.n+' · '+esc(t.topic)+'</small><strong>'+esc(t.title)+'</strong></span></label><p class="oge-task-snippet">'+esc(snippet(t))+'</p>'+badge(t,info.personal)+preview(t)+'</article>').join(''):'<div class="empty"><h2>Таких условий не нашлось</h2><p>Измени уровень, номер или статус. Для просмотра всего банка сбрось фильтры.</p></div>')+'</div>'+pager(rows.length)+'</section>'+
        '<aside class="builder-selection" id="oge-builder-selection"><div class="eyebrow">МОЯ ТРЕНИРОВКА ОГЭ</div><h2><span data-oge-selected-count>'+selected.length+'</span> из '+K.maxTasks+' условий</h2><p class="given">Можно выбрать несколько разных версий одного номера. Каждое условие добавляется один раз. Порядок можно менять.</p>'+
        '<div class="oge-selection-stats"><span>'+selected.reduce((sum,t)=>sum+t.max,0)+' баллов</span><span>≈ '+minutes+' мин на решение</span></div>'+
        (selected.some(t=>t.manual)?'<p class="oge-timer-explainer">Практические работы: до 5 МБ на один файл, до 32 МБ вложений на всю подборку.</p>':'')+
        '<label><span class="label">Длительность</span><select class="matching-select" id="oge-builder-time">'+K.timeLimits.map(value=>'<option value="'+value+'" '+(draft.timeLimitMinutes===value?'selected':'')+'>'+(value===0?'Без таймера':value+' минут')+'</option>').join('')+'</select></label><p class="oge-timer-explainer">'+(draft.timeLimitMinutes?'Через '+draft.timeLimitMinutes+' мин тренировка завершится автоматически. Таймер продолжает идти при закрытии вкладки.':'Решай в своём темпе и заверши тренировку, когда будешь готов. Ответы сохраняются автоматически.')+' Полный экран и сохранение работают в обоих режимах.</p>'+
        (draft.timeLimitMinutes&&minutes>draft.timeLimitMinutes?'<p class="oge-time-fit">По оценке условий понадобится ≈ '+minutes+' мин. Можно увеличить время или выбрать «Без таймера».</p>':'')+
        '<label><span class="label">Формат задания №13</span><select class="matching-select" id="oge-builder-choice"><option value="13.1" '+(draft.choice13==='13.1'?'selected':'')+'>13.1 · Презентация (.odp)</option><option value="13.2" '+(draft.choice13==='13.2'?'selected':'')+'>13.2 · Документ (.odt)</option></select></label>'+
        '<ol class="selected-tasks">'+selected.map((t,i)=>'<li><span class="selected-position">'+(i+1)+'</span><div><strong>№'+t.n+' · '+esc(t.title)+'</strong><small>'+esc(K.labels[t.difficulty])+' · '+esc(t.bankId)+'</small></div><div class="order-buttons"><button data-oge-builder-action="up" data-id="'+t.bankId+'" '+(i===0?'disabled':'')+' aria-label="Поднять условие '+(i+1)+'">↑</button><button data-oge-builder-action="down" data-id="'+t.bankId+'" '+(i===selected.length-1?'disabled':'')+' aria-label="Опустить условие '+(i+1)+'">↓</button><button data-oge-builder-action="remove" data-id="'+t.bankId+'" aria-label="Убрать условие '+(i+1)+', номер ОГЭ '+t.n+'">×</button></div></li>').join('')+'</ol>'+
        (!selected.length?'<p class="builder-empty">Отметь условия в банке или подбери их автоматически.</p>':'')+
        '<div class="actions"><button class="btn btn-secondary" data-oge-builder-action="export" '+(!selected.length?'disabled':'')+'>Скачать подборку</button><button class="tool-button" data-oge-builder-action="clear" '+(!selected.length?'disabled':'')+'>Очистить</button></div>'+
        '<button type="submit" form="oge-builder-start" class="btn btn-primary oge-selection-start" '+(!selected.length?'disabled':'')+'>Пройти выбранные условия →</button>'+
        '<p class="given">Выбор и длительность сохраняются автоматически. Это практика: баллы за выбранные условия без отметки за полный ОГЭ. Перед стартом доступны нужные файлы. После завершения — разбор, PDF и JSON.</p><p class="given">'+(draft.automatic?'Автоподбор исключает условия, уже встречавшиеся по указанным имени и классу в текущем круге.':'Ручной выбор позволяет намеренно повторять уже пройденные условия.')+'</p></aside></div>'+
        '<div class="builder-mobile-bar"><span><strong>'+selected.length+'</strong> условий выбрано</span><button class="btn btn-primary" data-oge-builder-action="selection">К моей тренировке →</button></div><div class="builder-mobile-spacer"></div><input type="file" class="visually-hidden" id="oge-builder-file" accept=".json,application/json"></section>');
    }
    const mounted=()=>!!document.querySelector('#oge-builder')&&!isActive();
    function rerender(){
      const scroll=window.scrollY,active=document.activeElement,row=active?.closest('.selected-tasks li'),rowIndex=row?[...row.parentElement.children].indexOf(row):-1;
      const attrs=['data-oge-task','data-oge-filter','data-oge-page','data-oge-builder-action','data-id','aria-label'].filter(a=>active?.hasAttribute(a)),form=active?.closest('form[id]');
      const selector=active?.id?'#'+CSS.escape(active.id):attrs.length?active.tagName.toLowerCase()+attrs.map(a=>'['+a+'="'+CSS.escape(active.getAttribute(a))+'"]').join(''):form?'#'+CSS.escape(form.id)+(active.name?' [name="'+CSS.escape(active.name)+'"]':' '+active.tagName.toLowerCase()):null;
      const selection=active&&['text','search',''].includes(active.type)?[active.selectionStart,active.selectionEnd]:null;
      render();let next=selector&&document.querySelector(selector);
      if(next?.disabled&&active?.dataset.id)next=document.querySelector('[data-id="'+CSS.escape(active.dataset.id)+'"]:not(:disabled)');
      if((!next||next.disabled)&&rowIndex>=0){const rows=document.querySelectorAll('.selected-tasks li');next=rows[Math.min(rowIndex,rows.length-1)]?.querySelector('button:not(:disabled)');}
      if(next&&!next.disabled&&next!==document.body){next.focus({preventScroll:true});if(selection&&selection[0]!==null)next.setSelectionRange(...selection);}window.scrollTo(0,scroll);
    }
    function updateAutoError(){
      const info=K.availability(input()),message=autoError(info),form=document.querySelector('#oge-builder-auto');
      if(!form)return;form.querySelector('button').disabled=!!message;form.querySelector('[name=count]').max=Math.max(1,info.maxCount);document.querySelector('#oge-builder-auto-error').textContent=message;
    }
    document.addEventListener('click',e=>{
      if(!mounted())return;const b=e.target.closest('[data-oge-builder-action]');if(!b||b.disabled)return;const action=b.dataset.ogeBuilderAction;
      if(action==='selection'){document.querySelector('#oge-builder-selection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
      if(action==='import'){document.querySelector('#oge-builder-file').click();return;}
      if(action==='export'){const blob=new Blob([JSON.stringify({kind:'1430-oge-training',schema:2,choice13:draft.choice13,taskIds:draft.taskIds,timeLimitMinutes:draft.timeLimitMinutes},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='1430-oge-training.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
      if(action==='page'){page=Number(b.dataset.page);rerender();document.querySelector('.builder-bank-tools').scrollIntoView({block:'start'});return;}
      if(action==='reset'){filters=defaults();page=1;rerender();return;}
      try{
        if(action==='clear')draft={...draft,taskIds:[],automatic:false};
        else if(action==='remove')draft=K.toggle(draft,b.dataset.id,false);
        else if(action==='up'||action==='down'){const i=draft.taskIds.indexOf(b.dataset.id),j=i+(action==='up'?-1:1);if(i>=0&&j>=0&&j<draft.taskIds.length)[draft.taskIds[i],draft.taskIds[j]]=[draft.taskIds[j],draft.taskIds[i]];}
        else return;
        save();rerender();
      }catch(err){toast(err.message);}
    });
    document.addEventListener('input',e=>{
      if(!mounted())return;
      if(e.target.closest('#oge-builder-auto')&&e.target.name==='count'){autoCount=e.target.value;updateAutoError();}
      if(e.target.closest('#oge-builder-start')){
        if(e.target.name==='student')name=e.target.value;if(e.target.name==='schoolClass')schoolClass=e.target.value;profileTouched=true;
        if(!name.trim()||!schoolClass.trim())filters.status='all';page=1;clearTimeout(profileTimer);profileTimer=setTimeout(()=>{if(mounted())rerender();},180);
      }
      if(e.target.dataset.ogeFilter==='search'){filters.search=e.target.value;page=1;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(mounted())rerender();},180);}
    });
    document.addEventListener('change',async e=>{
      if(!mounted())return;const el=e.target;
      if(el.hasAttribute('data-oge-task')){try{draft=K.toggle(draft,el.dataset.ogeTask,el.checked);save();rerender();}catch(err){el.checked=draft.taskIds.includes(el.dataset.ogeTask);toast(err.message);}}
      if(el.dataset.ogeFilter&&el.dataset.ogeFilter!=='search'){filters[el.dataset.ogeFilter]=el.value;page=1;rerender();}
      if(el.hasAttribute('data-oge-page')){page=Number(el.value);rerender();}
      if(el.id==='oge-builder-choice'){draft.choice13=el.value;save();rerender();}
      if(el.id==='oge-builder-time'){draft.timeLimitMinutes=Number(el.value);save();rerender();}
      if(el.id==='oge-builder-file'&&el.files[0]){try{if(el.files[0].size>500000)throw Error('Файл подборки слишком большой.');const v=JSON.parse(await el.files[0].text());if(v?.kind!=='1430-oge-training'||![1,2].includes(v.schema))throw Error('Нужен файл подборки ОГЭ из конструктора.');const next=K.validateDraft({...v,automatic:false});if(!next.taskIds.length)throw Error('Подборка пуста.');draft=next;save();rerender();toast('Подборка ОГЭ загружена. Проверь имя, класс и длительность.');}catch(err){toast(err.message);}}
    });
    document.addEventListener('submit',e=>{
      if(!mounted())return;
      if(e.target.id==='oge-builder-auto'){e.preventDefault();try{draft=K.auto({...input(),count:Number(e.target.elements.count.value),timeLimitMinutes:draft.timeLimitMinutes});save();rerender();toast('Подборка готова. Проверь условия и длительность справа.');}catch(err){document.querySelector('#oge-builder-auto-error').textContent=err.message;}}
      if(e.target.id==='oge-builder-start'){e.preventDefault();name=e.target.elements.student.value;schoolClass=e.target.elements.schoolClass.value;try{onStart(K.validateDraft(draft),student());}catch(err){const error=document.querySelector('#oge-builder-start-error');error.textContent=err.message;error.scrollIntoView({block:'center'});}}
    });
    function setDraft(next,who){
      if(isActive())throw Error('Сначала заверши начатую тренировку.');
      draft=K.validateDraft(next);if(who){name=String(who.name||'');schoolClass=String(who.schoolClass||who.class||'');profileTouched=true;}
      filters=defaults();page=1;save();render();return K.validateDraft(draft);
    }
    return {render,setDraft};
  }};
})(typeof globalThis!=='undefined'?globalThis:this);
