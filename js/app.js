import {GRADES,BANK_VERSION,BANK_STATS,DIFFICULTIES,generateQuestions,generatePracticeQuestions,checkAnswer} from './bank.js';
import {makeAssignmentUrl,readAssignmentUrl,normalizeAssignment} from './assignment.js';
import {renderPrompt,renderCode} from './presentation.js';
import {solutionSteps,resultFeedback,canShowSolutions} from './solutions.js';
import {createConstructorController} from './constructor-ui.js';
import {createConstructorAssignment,generateConstructorQuestions} from './constructor.js';
import {mountPythonHighlight} from './python-highlight.js';
import {calculate,formatCalculator} from './calculator.js';
import {PythonEngine} from './python-engine.js';
import {renderReportPages,createPdf,createPngZip,downloadBlob,downloadPngPage,safeFilename} from './export.js';
import {PROFILES,STRICT_LIMIT,DEFAULT_THRESHOLDS,deadlinePassed,event,hideAttempt,showAttempt,conductSummary,calculateResult,normalizeOutput,formatDuration} from './session.js';
import {loadPreferences,savePreferences,checkpoint,saveAttempt,listAttempts,deleteAttempt,onStorageError,onAttemptConflict,syncAttempt} from './storage.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
const modeName=mode=>mode==='control'?'Контроль':'Тренировка';
const saved=loadPreferences();
if('scrollRestoration' in window.history)window.history.scrollRestoration='manual';
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const difficultyName=id=>id==='custom'?'По плану работы':DIFFICULTIES.find(d=>d.id===id)?.title||'Без уровня';
const gradeScaleText=thresholds=>{const t={...DEFAULT_THRESHOLDS,...thresholds};return `Оценка 5 — от ${t.five}%; 4 — от ${t.four}%; 3 — от ${t.three}%; 2 — менее ${t.three}%.`;};
const seriesCode=seed=>Number(seed).toString(36).toUpperCase().padStart(7,'0');
const variantLabel=a=>a.seriesId?`${String(a.variant).padStart(2,'0')} · набор ${a.seriesId}`:String(a.variant);
const missedQuestions=a=>a?.phase==='finished'?a.questions.filter(q=>{const r=a.responses[q.id];return r&&!r.gradingUnavailable&&r.correct!==true&&r.checked;}):[];
const state={prefs:{grade:7,topicId:'all',mode:'training',profileId:'quick',strict:false,difficulty:'mixed',variant:1,seed:randomSeed(),...saved},screen:'home',attempt:null,entries:[],engine:null,running:false,grading:false,toolContext:null,pages:[],exportAttempt:null,pythonRunToken:0,assignment:null,assignmentError:'',draft:null,shareConfig:null};
if(!GRADES.some(g=>g.grade===Number(state.prefs.grade)))state.prefs.grade=7;
if(!PROFILES.some(p=>p.id===state.prefs.profileId))state.prefs.profileId='quick';
if(!['training','control'].includes(state.prefs.mode))state.prefs.mode='training';
if(!DIFFICULTIES.some(d=>d.id===state.prefs.difficulty))state.prefs.difficulty='mixed';
if(!Number.isInteger(state.prefs.variant)||state.prefs.variant<1||state.prefs.variant>30)state.prefs.variant=1;
if(!Number.isInteger(state.prefs.seed)||state.prefs.seed<0||state.prefs.seed>4294967295)state.prefs.seed=randomSeed();
const pythonHighlight=mountPythonHighlight($('#python-code'));
let saveTimer,toastTimer,confirmation;
const constructorController=createConstructorController({root:$('#main'),onStart:startConstructedDraft,onIssue:shareConstructedDraft,onNotice:toast});
const active=()=>state.attempt?.phase==='active';
function canEdit(){if(!active())return false;if(deadlinePassed(state.attempt)){finishAttempt('Время истекло',state.attempt.endAt);return false;}return true;}
const profile=()=>PROFILES.find(p=>p.id===state.prefs.profileId)||PROFILES[0];
const topics=()=>GRADES.find(g=>g.grade===Number(state.prefs.grade)).topics;
const topicTitle=()=>state.prefs.profileId==='final'||state.prefs.topicId==='all'?'Все темы класса':topics().find(t=>t.id===state.prefs.topicId)?.title||'Все темы класса';
const reply=q=>state.attempt.responses[q.id];
const answered=(q,r)=>q.kind==='program'?Boolean(r.code?.trim()&&r.code.trim()!==q.starterCode?.trim()):Boolean(r.text?.trim());
const toolPolicy=(mode,profileId,questions)=>({calculator:mode==='training'||profileId!=='quick',python:mode==='training'||profileId!=='quick'||questions.some(q=>q.kind==='program')});
const policyText=a=>a.mode==='training'?'Без ограничения времени. Доступны проверка и разбор.':`Лимит ${a.minutes} мин. Ответы проверяются после завершения. ${a.strict?`Работа завершается после ${STRICT_LIMIT} скрытий страницы.`:'Скрытия страницы записываются в журнал.'}`;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function persist(immediate=false){
  if(!state.attempt)return;
  const attempt=state.attempt;
  clearTimeout(saveTimer);if(!checkpoint(attempt))return false;
  // Recovery is synchronous; clone the durable snapshot only when this write runs.
  const write=async()=>{const snapshot=structuredClone(attempt);const saved=await saveAttempt(snapshot,{checkpointed:true});if(!saved)return false;const entry=state.attempt?.id===snapshot.id?structuredClone(state.attempt):snapshot;const i=state.entries.findIndex(a=>a.id===snapshot.id);if(i<0)state.entries.unshift(entry);else state.entries[i]=entry;$('#history-count').textContent=state.entries.length;return true;};
  if(immediate)return write();saveTimer=setTimeout(write,250);
}
function handleAttemptConflict({attempt,current}){
  if(state.attempt?.id!==attempt.id)return;
  const live=state.attempt.storageVersion,latest=current.storageVersion;
  if(live&&latest&&live.writer===latest.writer&&live.baseToken===latest.baseToken&&live.revision>=latest.revision)return;
  clearTimeout(saveTimer);state.pythonRunToken++;state.engine?.stop();state.running=false;state.grading=current.phase==='grading';state.toolContext=null;
  $('#python-run').disabled=false;$('#python-stop').disabled=true;$('#python-code').readOnly=false;$('#python-input').readOnly=false;
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();resolveConfirm(false);
  state.attempt=structuredClone(current);const i=state.entries.findIndex(a=>a.id===current.id);if(i<0)state.entries.unshift(current);else state.entries[i]=current;
  $('#history-count').textContent=state.entries.length;showScreen(current.phase==='finished'?'result':'work');
  toast('Работа обновлена в другой вкладке. Открыта сохранённая версия; повторите последний ввод и продолжайте в одной вкладке.');
}
function confirmAction(title,message,actionLabel='Подтвердить'){
  $('#confirm-content').innerHTML=`<h2>${esc(title)}</h2><p class="muted">${esc(message)}</p>`;$('#confirm-ok').textContent=actionLabel;$('#confirm-dialog').showModal();
  return new Promise(resolve=>confirmation=resolve);
}
function resolveConfirm(value){$('#confirm-dialog').close();confirmation?.(value);confirmation=null;}
function showScreen(name,{focus=true}={}){
  state.screen=name;document.body.classList.toggle('focus-mode',name==='work');$('#main').dataset.screen=name;document.querySelectorAll('.nav-item').forEach(b=>{const current=b.dataset.screen===name||(name==='work'&&b.dataset.screen==='home');b.classList.toggle('active',current);if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#breadcrumb').textContent={home:'Практика по информатике',work:'Моя работа',result:'Результат работы',history:'Мои работы',about:'Как это работает',constructor:'Конструктор вариантов'}[name];
  ({home:renderHome,work:renderWork,result:renderResult,history:renderHistory,about:renderAbout,constructor:renderConstructor}[name]||renderHome)();
  if(focus){$('#main').focus({preventScroll:true});document.documentElement.scrollTop=0;document.body.scrollTop=0;}
}
function activeBanner(){return active()?`<div class="notice notice-flex active-banner"><div><strong>Работа начата</strong><br>${esc(state.attempt.topicTitle)} · ${modeName(state.attempt.mode)}${state.attempt.mode==='control'?' · таймер продолжает идти':''}</div><button class="button secondary" data-action="resume">Продолжить →</button></div>`:'';}
function getLocalConfig(){
  const p=profile();return {v:1,bankVersion:BANK_VERSION,title:'',grade:Number(state.prefs.grade),topicId:p.id==='final'?'all':state.prefs.topicId,profileId:p.id,difficulty:state.prefs.difficulty,seed:state.prefs.seed,variant:Number(state.prefs.variant),mode:state.prefs.mode,strict:state.prefs.mode==='control'&&state.prefs.strict,minutes:p.minutes};
}
function assignmentProfile(config){return config.profileId==='custom'?{id:'custom',title:'Составленная работа',count:config.slots.length,minutes:config.minutes}:PROFILES.find(p=>p.id===config.profileId);}
function assignmentToConstructorDraft(config){return {id:config.workId,revision:config.revision,title:config.title,grade:config.grade,mode:config.mode,minutes:config.minutes,strict:config.strict,calculator:config.calculator,python:config.python,thresholds:structuredClone(config.thresholds),seed:config.seed,slots:config.slots.map((slot,i)=>({id:`slot-${i+1}`,templateId:slot.templateId,points:slot.points}))};}
function questionsFor(config){
  if(config.profileId==='custom')return generateConstructorQuestions(assignmentToConstructorDraft(config),{variant:config.variant,bankVersion:config.bankVersion});
  const p=assignmentProfile(config);return generateQuestions({grade:config.grade,topicId:config.topicId,count:p.count,seed:config.seed,difficulty:config.difficulty,variant:config.variant,bankVersion:config.bankVersion});
}
function configTopic(config){
  if(config.profileId==='custom'){const topics=[...new Set(questionsFor(config).map(q=>q.topicTitle))];return topics.join(' / ');}
  return config.topicId==='all'?'Все темы класса':GRADES.find(g=>g.grade===config.grade)?.topics.find(t=>t.id===config.topicId)?.title||'Тема';
}
function renderConstructor(){
  if(active()){ $('#main').innerHTML=`${activeBanner()}<div class="notice"><h2>Конструктор вариантов</h2><p>Завершите текущую работу, чтобы открыть сборку и предпросмотр заданий. Черновик конструктора сохранён отдельно.</p></div>`;return;}
  constructorController.render();
}
function startConstructedDraft(draft,variant=1){
  if(active()||state.grading){toast('Сначала завершите текущую работу.');return;}
  const config=createConstructorAssignment(draft,{variant});
  prepareStart({config,questions:questionsFor(config),tools:{calculator:config.calculator,python:config.python},topicTitle:configTopic(config),profileTitle:'Составленная работа',source:'constructor'});
}
function shareConstructedDraft(draft,variant=1){
  if(active()||state.grading){toast('Сначала завершите текущую работу.');return;}
  openShareConfig(createConstructorAssignment(draft,{variant}));
}
function difficultySummary(questions){return DIFFICULTIES.filter(d=>d.id!=='mixed').map(d=>({title:d.title,count:questions.filter(q=>q.difficulty===d.id).length})).filter(d=>d.count).map(d=>`${d.title}: ${d.count}`).join(' · ');}
function availableTools(tools){return [tools.calculator?'калькулятор':'',tools.python?'Python':''].filter(Boolean).join(' и ')||'без встроенных инструментов';}
function renderAssignedHome(){
  const c=state.assignment,p=assignmentProfile(c);
  $('#main').innerHTML=`${activeBanner()}<span class="eyebrow">РАБОТА ПО ССЫЛКЕ · ${c.grade} КЛАСС</span><h1>${esc(c.title||configTopic(c))}</h1><p class="muted">Вариант и правила уже заданы. Введите имя и приступайте к работе.</p><section class="setup-card assignment-card"><div class="assignment-meta"><div><span>Тема</span><strong>${esc(configTopic(c))}</strong></div><div><span>Формат</span><strong>${p.title} · ${p.count} заданий</strong></div><div><span>Сложность</span><strong>${esc(difficultyName(c.profileId==='custom'?'custom':c.difficulty))}</strong></div><div><span>Вариант / набор</span><strong>${String(c.variant).padStart(2,'0')} / ${seriesCode(c.seed)}</strong></div><div><span>Режим</span><strong>${modeName(c.mode)}${c.mode==='control'?' · '+c.minutes+' мин':''}</strong></div><div><span>Инструменты</span><strong>${availableTools(c)}</strong></div></div>${c.profileId==='custom'?`<p class="tiny muted">Редакция ${c.revision} · ${c.slots.reduce((n,s)=>n+s.points,0)} баллов. ${esc(gradeScaleText(c.thresholds))}</p>`:''}<div class="policy-card"><strong>Параметры этой работы фиксированы</strong><p>${c.mode==='control'?(c.strict?'Третье скрытие страницы завершает работу.':'Скрытия страницы записываются в журнал.'):'Время не ограничено. Доступны проверка и разбор.'} Ответы сохраняются в этом браузере.</p></div><div class="setup-bottom"><button class="button primary" data-action="prepare-start" ${active()?'disabled':''}>Начать работу →</button><button class="button text-button" data-action="leave-assignment">Перейти к свободной практике</button></div></section>`;
}
function renderHome(){
  if(state.assignmentError){$('#main').innerHTML=`${activeBanner()}<div class="notice error"><h1>Не удалось открыть работу</h1><p>${esc(state.assignmentError)}</p><p>Попросите новую ссылку у того, кто выдал работу.</p><button class="button secondary" data-action="leave-assignment">Открыть свободную практику</button></div>`;return;}
  if(state.assignment){renderAssignedHome();return;}
  if(state.prefs.profileId==='final')state.prefs.topicId='all';
  if(state.prefs.topicId!=='all'&&!topics().some(t=>t.id===state.prefs.topicId))state.prefs.topicId='all';
  const p=profile(),isControl=state.prefs.mode==='control',preview=questionsFor(getLocalConfig());
  $('#main').innerHTML=`${activeBanner()}<section class="hero"><div><span class="eyebrow">ИНФОРМАТИКА · 7–11 КЛАССЫ</span><h1>Мыслить логично.<br>Решать самостоятельно.</h1><p>Задачи, тесты и программирование в одном месте.<br>Выберите тему — начните с первого решения.</p></div><div class="hero-art" aria-hidden="true"><span class="art-cross">+</span><strong>[1430]</strong><small>ДУМАТЬ · РЕШАТЬ · ПОНИМАТЬ</small></div></section>
  <section aria-labelledby="grade-title"><div class="section-heading"><h2 id="grade-title">Ваш класс</h2><span class="tiny muted">01 / ВЫБОР</span></div><div class="grade-strip">${GRADES.map(g=>`<button class="grade-button ${g.grade===Number(state.prefs.grade)?'selected':''}" data-grade="${g.grade}" aria-pressed="${g.grade===Number(state.prefs.grade)}">${g.grade} класс</button>`).join('')}</div></section>
  <section aria-labelledby="topic-title"><div class="section-heading"><h2 id="topic-title">Что будем решать?</h2><button class="all-topics ${state.prefs.topicId==='all'?'selected':''}" data-topic="all" aria-pressed="${state.prefs.topicId==='all'}">Все темы ↗</button></div><div class="topic-grid">${topics().map((t,i)=>`<button class="topic-card ${state.prefs.topicId===t.id?'selected':''}" data-topic="${t.id}" aria-pressed="${state.prefs.topicId===t.id}"><span class="topic-top"><span class="topic-symbol" aria-hidden="true">${['01','{ }','⌘','&gt;_'][i]}</span><span class="topic-number">0${i+1} ↗</span></span><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p></button>`).join('')}</div></section>
  <section class="setup-card" aria-labelledby="mode-title"><div class="section-heading"><h2 id="mode-title">Настройте работу</h2><span class="tiny muted">02 / СТАРТ</span></div><div class="setup-grid"><div><span class="field-label">Режим</span><div class="segmented" role="group" aria-label="Режим работы"><button data-mode="training" aria-pressed="${!isControl}">Тренировка</button><button data-mode="control" aria-pressed="${isControl}">Контроль</button></div></div><label class="field-label">Формат<select id="profile-select">${PROFILES.map(x=>`<option value="${x.id}" ${p.id===x.id?'selected':''}>${x.title} · ${x.count} заданий</option>`).join('')}</select></label><label class="field-label">Сложность<select id="difficulty-select">${DIFFICULTIES.map(d=>`<option value="${d.id}" ${state.prefs.difficulty===d.id?'selected':''}>${esc(d.title)}</option>`).join('')}</select></label><label class="field-label">Вариант<select id="variant-select">${Array.from({length:30},(_,i)=>`<option value="${i+1}" ${Number(state.prefs.variant)===i+1?'selected':''}>Вариант ${i+1} из 30</option>`).join('')}</select></label></div>
  <p class="tiny muted difficulty-description">${esc(DIFFICULTIES.find(d=>d.id===state.prefs.difficulty)?.description)} Уровень относится к выбранным классу и теме.</p><div class="variant-strip"><div><span class="tiny muted">Набор </span><strong class="mono">${seriesCode(state.prefs.seed)}</strong><p class="tiny muted">${esc(difficultySummary(preview))}</p></div><button class="button text-button" data-action="new-series">Другой набор ↻</button></div>
  ${isControl?`<label class="field-label">Правила контроля<select id="strict-select"><option value="no" ${!state.prefs.strict?'selected':''}>Обычный · журнал скрытий страницы</option><option value="yes" ${state.prefs.strict?'selected':''}>Строгий · завершение после 3 скрытий</option></select></label>`:''}
  <div class="policy-card"><strong>${isControl?'Самостоятельная работа':'Практика в своём темпе'}</strong><p>${isControl?`${p.minutes} минут. Итоговая проверка после сдачи. ${state.prefs.strict?'Третье скрытие страницы завершает работу.':'Уходы со страницы будут отмечены в отчёте.'}`:'Проверяйте ответы, читайте объяснения и пробуйте снова. Калькулятор и Python под рукой.'}</p></div>
  <div class="setup-bottom"><div><strong>${esc(topicTitle())}</strong><div class="tiny muted">${p.count} заданий · ${isControl?p.minutes+' минут':'без ограничения времени'}</div></div><div class="button-row"><button class="button secondary" data-action="prepare-share">Работа по ссылке</button><button class="button primary" data-action="prepare-start">Начать работу →</button></div></div></section><p class="tiny muted">Варианты одного набора при одинаковых настройках имеют общую структуру, уровни и баллы. Без регистрации. Результаты сохраняются в этом браузере.</p>`;
}
function createDraft(){
  const config=state.assignment?{...state.assignment}:getLocalConfig();
  const questions=questionsFor(config),p=assignmentProfile(config);
  const tools=state.assignment?{calculator:config.calculator,python:config.python}:toolPolicy(config.mode,p.id,questions);
  if(!tools.python&&questions.some(q=>q.kind==='program'))throw new Error('В работе есть задания на программу, но Python отключён. Нужна исправленная ссылка.');
  return {config,questions,tools,topicTitle:configTopic(config),profileTitle:p.title,source:state.assignment?'assignment':'local'};
}
function prepareStart(providedDraft=null){
  if(active()){toast('Сначала завершите текущую работу — она доступна по кнопке «Продолжить».');return;}
  state.draft=providedDraft?.questions?providedDraft:createDraft();
  const d=state.draft,c=d.config,control=c.mode==='control';
  $('#start-dialog-content').innerHTML=`<span class="eyebrow">${modeName(c.mode).toUpperCase()} · ${c.grade} КЛАСС</span><h2>${d.source==='practice'?'Вернёмся к сложным заданиям':'Всё готово к началу'}</h2><p class="muted">${esc(d.topicTitle)} · ${d.questions.length} заданий${control?' · '+c.minutes+' минут':''}<br>${esc(difficultyName(c.profileId==='custom'?'custom':c.difficulty))} · вариант ${c.variant} · набор ${seriesCode(c.seed)}</p>${d.source==='practice'?`<div class="notice">Отдельная тренировка по ${d.questions.length} заданиям из завершённой работы. Исходная оценка сохранится. ${d.questions.some(q=>q.practiceRepeated)?'Некоторые условия повторяются: отметки будут показаны в заданиях.':'Исходные данные обновлены.'}</div>`:''}${c.profileId==='custom'?`<p class="tiny muted">Редакция ${c.revision}. ${esc(gradeScaleText(c.thresholds))}</p>`:''}<form id="student-form"><label class="field-label">Имя и фамилия<input id="student-name" name="studentName" autocomplete="name" required minlength="2" maxlength="80" value="${esc(d.studentName||state.prefs.studentName||'')}" placeholder="Например, Анна Иванова"></label><label class="field-label">Класс<input id="student-class" name="schoolClass" required maxlength="12" value="${esc(d.schoolClass||(state.prefs.schoolClass&&String(state.prefs.schoolClass).startsWith(String(c.grade))?state.prefs.schoolClass:c.grade))}" placeholder="Например, ${c.grade}А"></label><div class="notice"><strong>Правила работы</strong><ul>${control?`<li>Время начнётся после нажатия кнопки. Перезагрузка его не обнуляет.</li><li>Скрытия страницы фиксируются. ${c.strict?'Третье скрытие завершает работу.':'Ответы сохраняются, оценка за знания не снижается из-за уходов.'}</li><li>Инструменты: ${availableTools(d.tools)}. Проверка — после завершения.</li><li>Браузер не может полностью запретить переход в другие вкладки и приложения.</li>`:`<li>Время не ограничено. Можно проверять и исправлять каждый ответ.</li><li>Инструменты: ${availableTools(d.tools)}. Разбор доступен после проверки.</li>`}</ul></div>${control?'<label class="check-label"><input type="checkbox" id="start-fullscreen"> Открыть в полноэкранном режиме (по желанию)</label>':''}<p class="tiny muted">Имя будет только в локальной работе и скачанном отчёте.</p><button class="button primary full-width" type="submit">${control?'Начать контроль':'Начать тренировку'}</button></form>`;
  $('#start-dialog').showModal();$('#student-name').focus();
}
async function startAttempt(form){
  if(active()||state.grading||!state.draft)return;
  const name=form.elements.studentName.value.trim(),schoolClass=form.elements.schoolClass.value.trim();
  if(name.length<2||!schoolClass){toast('Введите имя и класс.');return;}
  const d=state.draft,c=d.config,questions=structuredClone(d.questions),seed=c.seed;
  const startedAt=Date.now(),id=crypto.randomUUID?.()||`1430-${startedAt}-${seed}`;
  state.attempt={version:4,bankVersion:c.bankVersion||BANK_VERSION,id,startedAt,endAt:c.mode==='control'?startedAt+c.minutes*60000:null,finishedAt:null,phase:'active',grade:c.grade,topicId:c.topicId,topicTitle:d.topicTitle,workTitle:c.title||'',profileId:c.profileId,profileTitle:d.profileTitle,minutes:c.minutes,mode:c.mode,strict:c.mode==='control'&&c.strict,studentName:name,schoolClass,seed,seriesId:seriesCode(seed),variant:c.variant,difficulty:c.profileId==='custom'?'custom':c.difficulty,thresholds:{...DEFAULT_THRESHOLDS,...c.thresholds},constructorWorkId:c.workId||null,constructorRevision:c.revision||null,source:d.source,sourceAttemptId:d.sourceAttemptId||null,sourceVariant:d.sourceVariant||null,assignmentConfig:d.source==='assignment'||d.source==='constructor'?structuredClone(c):null,blueprint:questions.map(q=>q.templateId),tools:{...d.tools},questions,responses:{},currentIndex:0,hiddenStartAt:null,events:[],result:null,scratch:{code:'print("Привет, 1430!")',stdin:'',output:'',error:null}};
  questions.forEach(q=>state.attempt.responses[q.id]={text:'',code:q.starterCode||'',stdin:q.tests?.[0]?.input||'',output:'',error:null,score:0,correct:null,checked:false,checkCount:0,gradingUnavailable:false});
  if(state.attempt.mode==='control')event(state.attempt,'start','Начало работы');
  state.prefs.studentName=name;state.prefs.schoolClass=schoolClass;savePreferences(state.prefs);
  const fullscreen=$('#start-fullscreen')?.checked;$('#start-dialog').close();state.draft=null;showScreen('work');await persist(true);
  if(fullscreen)document.documentElement.requestFullscreen?.().catch(()=>toast('Полноэкранный режим недоступен. Работа продолжается.'));
}
function prepareMistakes(){
  const parent=state.attempt,missed=missedQuestions(parent);if(!missed.length){toast('Нет проверенных заданий с ошибками.');return;}
  const seed=randomSeed(),questions=generatePracticeQuestions(missed,{seed,variant:1}).map((q,i)=>({...q,points:missed[i].points}));
  prepareStart({source:'practice',sourceAttemptId:parent.id,sourceVariant:variantLabel(parent),studentName:parent.studentName,schoolClass:parent.schoolClass,topicTitle:parent.topicTitle,profileTitle:'Работа над ошибками',tools:{calculator:true,python:true},questions,config:{grade:parent.grade,topicId:parent.topicId,profileId:'practice',mode:'training',strict:false,minutes:0,difficulty:parent.difficulty||'mixed',thresholds:{...DEFAULT_THRESHOLDS,...parent.thresholds},seed,variant:1,title:'Работа над ошибками'}});
}
function prepareShare(){
  if(state.assignment||state.assignmentError)return;
  const config=getLocalConfig(),questions=questionsFor(config),tools=toolPolicy(config.mode,config.profileId,questions);
  openShareConfig({...config,...tools});
}
function openShareConfig(config){
  const questions=questionsFor(config),hasProgram=questions.some(q=>q.kind==='program'),custom=config.profileId==='custom';
  state.shareConfig=structuredClone(config);
  $('#share-dialog-content').innerHTML=`<span class="eyebrow">ОДИН НАБОР · 30 ВАРИАНТОВ</span><h2>Поделиться работой</h2><p class="muted">${config.grade} класс · ${esc(configTopic(config))}<br>${esc(difficultyName(custom?'custom':config.difficulty))} · ${modeName(config.mode)} · набор ${seriesCode(config.seed)}${custom?' · редакция '+config.revision:''}</p>${custom?`<div class="notice">${questions.length} заданий · ${questions.reduce((n,q)=>n+q.points,0)} баллов. Порядок, баллы и правила закреплены в этой ссылке. ${esc(gradeScaleText(config.thresholds))}</div>`:''}<form id="share-form"><label class="field-label">Название работы<input id="share-title" maxlength="80" value="${esc(config.title)}" ${custom?'readonly':''} placeholder="Например, Системы счисления · 8А"></label>${config.mode==='control'?`<label class="field-label">Время, минут<input id="share-minutes" type="number" min="5" max="120" step="1" value="${config.minutes}" required ${custom?'readonly':''}></label>`:''}<div class="share-tools"><label class="check-label"><input id="share-calculator" type="checkbox" ${config.calculator?'checked':''} ${custom?'disabled':''}> Калькулятор</label><label class="check-label"><input id="share-python" type="checkbox" ${config.python||hasProgram?'checked':''} ${hasProgram||custom?'disabled':''}> Python${hasProgram?' · нужен для заданий':''}</label></div><p class="tiny muted">${custom?'Для изменения параметров вернитесь в конструктор. ':''}В ссылке будут только параметры работы. Она не содержит имён или ответов. Создание ссылки не отправляет её ученикам.</p><button class="button primary" type="submit">Создать ссылки</button></form><div id="share-result" hidden></div>`;
  $('#share-dialog').showModal();
}
function createShareLinks(form){
  const config=normalizeAssignment(state.shareConfig.profileId==='custom'?state.shareConfig:{...state.shareConfig,title:$('#share-title').value.trim(),minutes:$('#share-minutes')?Number($('#share-minutes').value):state.shareConfig.minutes,calculator:$('#share-calculator').checked,python:$('#share-python').checked});
  if(!config.python&&questionsFor(config).some(q=>q.kind==='program'))throw new Error('Включите Python: в работе есть программные задания.');
  state.shareConfig=config;
  const link=makeAssignmentUrl(config,window.location.href);
  $('#share-result').hidden=false;
  $('#share-result').innerHTML=`<label class="field-label">Ссылка на вариант ${config.variant}<textarea id="share-url" readonly rows="3">${esc(link)}</textarea></label><div class="button-row"><button class="button primary" data-action="copy-share">Скопировать ссылку</button><button class="button secondary" data-action="download-variants">Скачать 30 ссылок</button></div><p class="tiny muted">Варианты равноценны по структуре, сложности и баллам. Параметры фиксированы в интерфейсе ученика; ссылка не имеет серверной подписи.</p>${['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)?'<div class="notice warning">Это локальный адрес. Для учеников создайте ссылки на опубликованном сайте GitHub Pages.</div>':''}`;
}
async function copyShare(){try{await navigator.clipboard.writeText($('#share-url').value);toast('Ссылка скопирована');}catch{$('#share-url').focus();$('#share-url').select();toast('Ссылка выделена. Скопируйте её вручную.');}}
function downloadVariants(){
  const c=state.shareConfig;if(!c||!$('#share-url'))return;
  const lines=[`Код 1430 — ${c.title||configTopic(c)}`,`${c.grade} класс · ${difficultyName(c.profileId==='custom'?'custom':c.difficulty)} · ${modeName(c.mode)}`,`Набор ${seriesCode(c.seed)} · ${assignmentProfile(c).count} заданий${c.mode==='control'?' · '+c.minutes+' мин':''}`,`Инструменты: ${availableTools(c)}`,gradeScaleText(c.thresholds),...(c.profileId==='custom'?[`Редакция: ${c.revision} · шаблон ${c.workId}`]:[]),`Правила: ${c.mode==='training'?'без ограничения времени':c.strict?'завершение после 3 скрытий страницы':'журнал скрытий страницы'}`,'',...Array.from({length:30},(_,i)=>`Вариант ${i+1}
${makeAssignmentUrl({...c,variant:i+1},window.location.href)}
`)];
  downloadBlob(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}),safeFilename(`Код1430_30вариантов_${seriesCode(c.seed)}`)+'.txt');
}
function readSharedWork(){
  state.assignment=null;state.assignmentError='';
  try{state.assignment=readAssignmentUrl(window.location.href);}catch(error){state.assignmentError=error.message;}
}
function leaveAssignment(){state.assignment=null;state.assignmentError='';state.draft=null;window.history.replaceState(null,'',window.location.pathname+window.location.search);showScreen('home');}
function questionBody(q){return `${q.practiceRepeated||q.repeated?`<p class="notice warning">${esc(q.practiceNote||q.generationNote||'Для этого типа задания условие повторяется. Попробуйте решить самостоятельно.')}</p>`:''}${renderPrompt(q.prompt,{className:'question-prompt'})}${q.code?renderCode(q.code,{label:'Код из условия'}):''}`;}
function quantityLabel(value,forms){const last=value%10,hundred=value%100;return `${value} ${forms[hundred>=11&&hundred<=14?2:last===1?0:last>=2&&last<=4?1:2]}`;}
function focusHeader(a){
  return `<header class="focus-header"><button class="focus-brand" data-screen="home" aria-label="Код 1430 — главная">Код <span>[1430]</span></button><span class="focus-context">${modeName(a.mode)} · ${a.grade} класс</span><div class="timer" id="work-timer" role="timer" aria-live="off" aria-label="${a.mode==='control'?'Осталось времени':'Время работы'}"></div><details class="focus-menu"><summary aria-label="Меню приложения">Меню</summary><nav class="focus-menu-links" aria-label="Навигация по приложению"><button data-screen="home">Практика</button><button data-screen="constructor">Конструктор</button><button data-screen="history">Мои работы</button><button data-screen="about">Справка</button></nav></details></header>`;
}
function workSupport(a,q,count){
  const navigation=a.questions.map((question,i)=>{const response=reply(question),hasAnswer=answered(question,response);return `<button class="question-dot ${i===a.currentIndex?'current':''} ${hasAnswer?'answered':''} ${a.mode==='training'&&response.checked?(response.correct?'checked-good':'checked-bad'):''}" data-question="${i}" aria-label="Задание ${i+1}${hasAnswer?', ответ введён':''}" ${i===a.currentIndex?'aria-current="step"':''}>${i+1}</button>`;}).join('');
  return `<div class="focus-support"><details class="focus-navigation" name="work-support"><summary><span>Все задания</span><span class="focus-progress-count"><span class="sr-only">Ответы введены: </span><strong id="work-progress-label">${count} из ${a.questions.length}</strong></span></summary><div class="focus-navigation-content"><progress id="work-progress" value="${count}" max="${a.questions.length}" aria-label="Количество заданий с введённым ответом">${count} из ${a.questions.length}</progress><nav class="question-grid" aria-label="Переход к заданию">${navigation}</nav><p class="legend">Закрашены задания с ответом</p></div></details>${a.tools.calculator||a.tools.python?`<details class="focus-tools" name="work-support"><summary>Инструменты</summary><div class="tool-buttons">${a.tools.calculator?'<button class="button secondary" data-action="open-calculator">± Калькулятор</button>':''}${a.tools.python?'<button class="button secondary" data-action="open-python">&gt;_ Python</button>':''}</div></details>`:''}<details class="focus-about" name="work-support"><summary>О работе</summary><div class="session-info"><p><strong>${esc(a.workTitle||a.topicTitle)}</strong></p><p>${esc(a.studentName)} · ${esc(a.schoolClass)} · ${esc(a.profileTitle)}</p><p>Вариант ${esc(variantLabel(a))}${a.difficulty?' · '+esc(difficultyName(a.difficulty)):''}</p><p>${esc(policyText(a))}</p>${q.difficultyReason?`<p>Сложность задания: ${esc(q.difficultyReason)}</p>`:''}${a.mode==='control'?`<p id="conduct-count">Скрытий страницы: ${conductSummary(a).departures}${a.strict?' / '+STRICT_LIMIT:''}</p>`:''}<p class="tiny muted">${esc(a.id.slice(0,8))} · ${esc(a.bankVersion)}</p></div></details><footer class="focus-footer"><span class="save-indicator">Автосохранение на устройстве</span><button class="button secondary" data-action="ask-finish">Завершить работу</button></footer></div>`;
}
function renderWork(){
  const a=state.attempt;if(!a){showScreen('home');return;}if(a.phase==='finished'){showScreen('result');return;}
  if(a.phase==='grading'){$('#main').innerHTML=focusHeader(a)+'<div class="loading-screen"><h1>Проверяем работу</h1><p id="grading-status" role="status">Сверяем ответы и запускаем тесты программ…</p></div>';tick();return;}
  const q=a.questions[a.currentIndex],r=reply(q);
  const count=a.questions.filter(x=>answered(x,reply(x))).length;
  let answerHtml=q.kind==='choice'?`<fieldset class="choice-list"><legend class="sr-only">Выберите ответ</legend>${q.options.map(o=>`<label class="choice-option"><input type="radio" name="answer" value="${esc(o.value)}" ${r.text===o.value?'checked':''}><span>${esc(o.label)}</span></label>`).join('')}</fieldset>`:q.kind==='program'?`<div class="program-preview"><span class="field-label">Ваша программа</span>${renderCode(r.code||'# Откройте редактор и напишите решение',{label:'Ваш код',copy:Boolean(r.code)})}<button class="button secondary" data-action="open-program">Открыть Python →</button></div><p class="tiny muted">${quantityLabel(q.tests.length,['тест','теста','тестов'])} для автоматической проверки. За каждый пройденный тест начисляется часть баллов.</p>`:`<label class="field-label answer-field" for="answer-input">Ваш ответ<input id="answer-input" type="text" ${q.kind==='number'?'inputmode="decimal"':''} autocomplete="off" maxlength="500" value="${esc(r.text)}" placeholder="Введите ответ"></label>`;
  $('#main').innerHTML=`${focusHeader(a)}<h1 class="sr-only">${esc(a.workTitle||a.topicTitle)}</h1><div class="work-layout"><section class="question-card" aria-labelledby="question-title"><div class="question-top"><span>Задание ${a.currentIndex+1} из ${a.questions.length}</span><span>${quantityLabel(q.points,['балл','балла','баллов'])}${q.difficulty?' · '+esc(difficultyName(q.difficulty)):''}</span></div><h2 class="question-title" id="question-title" tabindex="-1">${esc(q.title)}</h2>${questionBody(q)}${answerHtml}<div class="question-actions">${a.mode==='training'?'<button class="button primary" data-action="check-answer">Проверить ответ</button>':''}<div class="button-row"><button class="button secondary" data-action="previous" ${a.currentIndex===0?'disabled':''}>← Назад</button><button class="button secondary" data-action="next" ${a.currentIndex===a.questions.length-1?'disabled':''}>Далее →</button></div></div>${a.mode==='training'&&r.checked?feedback(q,r):''}</section>${workSupport(a,q,count)}</div>`;
  tick();
}
function feedback(q,r){
  return `<div class="answer-feedback ${r.correct?'good':'bad'}" role="status"><strong>${r.gradingUnavailable?'Python недоступен — оценка пока не выставлена':r.correct?'Верно!':r.score>0?'Частично верно':'Пока неверно'}</strong>${r.gradingUnavailable?'<p>Сохраните код и повторите проверку после восстановления интерпретатора.</p>':`<ol class="feedback-steps">${solutionSteps(q).map(step=>`<li>${esc(step)}</li>`).join('')}</ol>${q.kind==='program'?renderCode(q.answer,{label:'Один из правильных вариантов программы'}):`<p>Правильный ответ: <strong>${esc(answerLabel(q,q.answer))}</strong></p>`}`}${r.testResults?.length?`<details class="program-test-details"><summary>Пройдено тестов: ${r.testResults.filter(t=>t.correct).length} из ${r.testResults.length}</summary><div class="program-tests">${r.testResults.map((t,i)=>`<div>Тест ${i+1}: ${t.correct?'пройден':'не пройден'}${t.error?' · '+esc(t.error):''}</div>`).join('')}</div></details>`:''}</div>`;
}
function answerLabel(q,value){return q.options?.find(o=>o.value===value)?.label??value??'';}
function updateResponse(text){
  if(!canEdit()||state.grading)return;const q=state.attempt.questions[state.attempt.currentIndex],r=reply(q);r.text=text;r.checked=false;r.correct=null;r.score=0;r.gradingUnavailable=false;
  $('#main .answer-feedback')?.remove();const dot=$(`[data-question="${state.attempt.currentIndex}"]`);dot?.classList.toggle('answered',answered(q,r));dot?.classList.remove('checked-good','checked-bad');
  dot?.setAttribute('aria-label',`Задание ${state.attempt.currentIndex+1}${answered(q,r)?', ответ введён':''}`);
  const count=state.attempt.questions.filter(x=>answered(x,reply(x))).length,total=state.attempt.questions.length;if($('#work-progress'))$('#work-progress').value=count;if($('#work-progress-label'))$('#work-progress-label').textContent=`${count} из ${total}`;persist();
}
async function gradeProgram(q,r,engine,isCurrent=()=>true){
  if(!answered(q,r)){Object.assign(r,{score:0,correct:false,checked:true,gradingUnavailable:false,testResults:[]});return;}
  const results=[];
  for(const test of q.tests){
    if(!isCurrent())return;
    const result=await engine.run(r.code,test.input,{timeoutMs:3000,maxOutput:8000});
    if(!isCurrent())return;
    if(result.infrastructureError){Object.assign(r,{score:0,correct:null,checked:true,gradingUnavailable:true,testResults:results});return;}
    results.push({correct:!result.error&&normalizeOutput(result.output)===normalizeOutput(test.output),error:result.error||null});
  }
  const passed=results.filter(t=>t.correct).length;
  Object.assign(r,{score:Math.round(q.points*passed/results.length*100)/100,correct:passed===results.length,checked:true,gradingUnavailable:false,testResults:results});
}
async function checkCurrent(){
  if(!active()||state.attempt.mode!=='training'||state.grading||state.running)return;
  const a=state.attempt,q=a.questions[a.currentIndex],r=reply(q),runToken=state.pythonRunToken;r.checkCount++;
  const isCurrent=()=>a===state.attempt&&a.phase==='active'&&runToken===state.pythonRunToken;
  if(q.kind==='program'){
    state.grading=true;const button=$('[data-action="check-answer"]');button.disabled=true;button.textContent='Проверяем программу…';
    await gradeProgram(q,r,getEngine(),isCurrent);if(!isCurrent())return;state.grading=false;
  }else Object.assign(r,checkAnswer(q,r.text),{checked:true});
  if(state.attempt===a){persist();if(state.screen==='work'){renderWork();$('[data-action="check-answer"]')?.focus({preventScroll:true});}}
}
async function askFinish(){
  if(!canEdit()||state.grading)return;
  const a=state.attempt,missing=a.questions.filter(q=>!answered(q,reply(q))).length;
  const yes=await confirmAction('Завершить работу?',missing?`Без ответа: ${missing}. После завершения изменить ответы будет нельзя.`:'Все ответы введены. После завершения изменить их будет нельзя.','Завершить и проверить');
  if(yes&&canEdit())await finishAttempt('Работа сдана учеником');
}
async function finishAttempt(reason='Работа сдана учеником',finishedAt=Date.now()){
  const a=state.attempt;if(!a||a.phase==='finished'||(state.grading&&a.phase==='grading'))return;
  if(a.mode==='control'&&finishedAt>=a.endAt){finishedAt=a.endAt;reason='Время истекло';}
  clearTimeout(saveTimer);state.pythonRunToken++;state.engine?.stop();state.running=false;$('#python-run').disabled=false;$('#python-stop').disabled=true;$('#python-code').readOnly=false;$('#python-input').readOnly=false;state.grading=true;
  if(a.hiddenStartAt!=null){const closure=showAttempt(a,finishedAt);closure.label='Учёт отсутствия завершён с работой';}
  a.phase='grading';a.finishedAt=finishedAt;a.finishReason=reason;
  if(a.mode==='control')event(a,'finish',reason,finishedAt);
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  resolveConfirm(false);showScreen('work');await persist(true);if(a!==state.attempt)return;
  await performGrading(a);
}
async function performGrading(a){
  state.grading=true;let infrastructureFailed=false;
  try{
    for(let i=0;i<a.questions.length;i++){
      if(a!==state.attempt||a.phase!=='grading')return;
      const q=a.questions[i],r=a.responses[q.id];
      if($('#grading-status'))$('#grading-status').textContent=`Задание ${i+1} из ${a.questions.length}${q.kind==='program'?' · тестируем программу':''}`;
      if(q.kind==='program'){
        if(infrastructureFailed&&answered(q,r))Object.assign(r,{score:0,correct:null,checked:true,gradingUnavailable:true,testResults:[]});
        else await gradeProgram(q,r,getEngine(),()=>a===state.attempt&&a.phase==='grading');
        if(a!==state.attempt)return;
        if(r.gradingUnavailable)infrastructureFailed=true;
      }else Object.assign(r,checkAnswer(q,r.text),{checked:true});
    }
  }catch(error){
    a.questions.filter(q=>q.kind==='program'&&!a.responses[q.id].checked).forEach(q=>Object.assign(a.responses[q.id],{gradingUnavailable:true,correct:null}));
    toast('Часть программ не удалось проверить. Код сохранён, проверку можно повторить.');
  }
  if(a!==state.attempt)return;
  a.result=calculateResult(a.questions,a.responses,a.thresholds);a.phase='finished';state.grading=false;await persist(true);if(a===state.attempt)showScreen('result');
}
function solutionMarkup(q){
  return `<section class="solution-walkthrough"><h3>Ход правильного решения</h3><ol class="solution-steps">${solutionSteps(q).map(step=>`<li>${esc(step)}</li>`).join('')}</ol>${q.kind==='program'?renderCode(q.answer,{label:'Один из правильных вариантов программы'}):''}</section>`;
}
function resultStatus(response){
  if(response.gradingUnavailable)return {kind:'pending',label:'Ожидает проверки',symbol:'?'};
  if(response.correct===true)return {kind:'good',label:'Верно',symbol:'✓'};
  if(response.score>0)return {kind:'partial',label:'Частично верно',symbol:'◐'};
  return {kind:'bad',label:'Нужно разобрать',symbol:'−'};
}
function comparisonMarkup(q,v,reveal){
  if(q.kind==='program')return `<div class="answer-comparison is-program"><section class="student-answer-panel"><h3>Ваша программа</h3>${v.code?renderCode(v.code,{label:'Ваше решение'}):'<p class="muted">Программа не введена</p>'}${v.output?`<details class="last-output"><summary>Последний вывод программы</summary><pre class="code-block">${esc(v.output)}</pre></details>`:''}${v.error?`<p class="inline-error">${esc(v.error)}</p>`:''}</section></div>`;
  return `<div class="answer-comparison"><section class="student-answer-panel"><h3>Ваш ответ</h3><p>${esc(answerLabel(q,v.text)||'Ответ не указан')}</p></section>${reveal?`<section class="correct-answer-panel"><h3>Правильный ответ</h3><p class="solution-answer">${esc(answerLabel(q,q.answer))}</p></section>`:''}</div>`;
}
function resultQuestionMarkup(q,i,a,reveal){
  const v=a.responses[q.id]||{},status=resultStatus(v);
  return `<details class="result-question" id="result-question-${i}" data-result-status="${status.kind}" ${reveal?'open':''}><summary><span><span class="status-chip ${status.kind==='good'?'good':status.kind==='bad'?'bad':''}">${i+1}</span><span class="result-question-title">${esc(q.title)}</span></span><span class="result-summary-right"><span class="result-outcome ${status.kind}">${status.label}</span><strong>${v.score||0} / ${q.points}</strong><span class="result-chevron" aria-hidden="true">⌄</span></span></summary><div class="result-body">${q.difficulty?`<span class="difficulty-chip ${q.difficulty}">${esc(q.difficultyTitle||difficultyName(q.difficulty))}</span>`:''}${questionBody(q)}${comparisonMarkup(q,v,reveal)}${v.gradingUnavailable?'<p class="notice warning">Не проверено: интерпретатор недоступен.</p>':''}${reveal?solutionMarkup(q):''}</div></details>`;
}
function renderResult(){
  const a=state.attempt;if(!a||a.phase!=='finished'){showScreen('home');return;}
  const mistakes=missedQuestions(a),r=a.result,c=conductSummary(a),elapsed=Math.max(0,Math.floor((a.finishedAt-a.startedAt)/1000));
  const reveal=canShowSolutions(a),feedback=resultFeedback(r),reviewCount=a.questions.filter(q=>a.responses[q.id]?.correct!==true).length;
  $('#main').innerHTML=`<section class="result-hero"><div><span class="eyebrow">${a.mode==='control'?'КОНТРОЛЬ ЗАВЕРШЁН':'ТРЕНИРОВКА ЗАВЕРШЕНА'}</span><h1>${r.pending?'Работа сохранена':'Работа готова'}</h1><p>${esc(a.workTitle||a.topicTitle)} · ${a.grade} класс · вариант ${esc(variantLabel(a))}</p></div><div class="big-mark">${r.mark??'—'}<span>${r.pending?'проверка не завершена':'оценка за знания'}</span></div></section>
  <div class="report-student">${esc(a.studentName)} · ${esc(a.schoolClass)} · ${date(a.finishedAt)}${a.difficulty?' · '+esc(difficultyName(a.difficulty)):''}</div>
  <div class="result-stats"><div class="stat-card"><span>Баллы${r.pending?' · предварительно':''}</span><strong>${r.score} <small>/ ${r.maxScore}</small></strong></div><div class="stat-card"><span>Набрано баллов</span><strong>${r.percent}%</strong><progress class="score-progress" value="${r.percent}" max="100" aria-label="Доля набранных баллов">${r.percent}%</progress></div><div class="stat-card"><span>Время работы</span><strong>${formatDuration(elapsed)}</strong></div></div>
  ${feedback?`<aside class="result-feedback" data-feedback-mark="${feedback.mark}"><span class="eyebrow">${esc(feedback.title)}</span><blockquote>«${esc(feedback.quote)}»</blockquote><p>${esc(feedback.next)}</p><span class="tiny muted">${esc(feedback.signature)}</span></aside>`:''}
  ${a.source==='practice'?`<div class="notice">Тренировка ошибок по варианту ${esc(a.sourceVariant)}. Исходная работа и её оценка сохранены отдельно.</div>`:''}
  ${r.pending?'<div class="notice warning">Некоторые программы не удалось проверить из-за сбоя Python. Итоговая оценка пока не выставлена. Разбор всей работы откроется после завершения проверки. <button class="button secondary" data-action="retry-grading">Повторить проверку</button></div>':''}
  <div class="button-row result-actions"><button class="button primary" data-action="export">Скачать работу · PDF / PNG</button>${mistakes.length?`<button class="button secondary" data-action="practice-mistakes">Работа над ошибками · ${mistakes.length}</button>`:''}<button class="button text-button" data-action="new-work">Новая работа →</button></div>
  <p class="scale-line">${esc(gradeScaleText(a.thresholds))} ${a.mode==='training'?'В тренировке учитывается последний ответ после исправлений.':''}</p>
  ${a.mode==='control'?`<details class="conduct-details"><summary>Журнал контроля · скрытий: ${c.departures}</summary><div class="notice ${c.departures?'warning':''}"><strong>Соблюдение режима: ${c.departures?'есть события в журнале':'скрытий страницы не зафиксировано'}</strong><p>Время отсутствия: ${formatDuration(c.durationMs/1000)}. ${esc(a.finishReason)}.</p><p class="tiny">Журнал не изменяет оценку за знания и сам по себе не доказывает нарушение.</p>${a.events.length?`<ul class="event-list">${a.events.map(e=>`<li>${date(e.at)} · ${esc(e.label)}${e.durationMs!=null?' · '+formatDuration(e.durationMs/1000):''}</li>`).join('')}</ul>`:''}</div></details>`:''}
  <section class="result-nav" aria-label="Навигация по результатам"><div class="section-heading"><h2>${reveal?'Разбор правильных решений':'Задания и ваши ответы'}</h2>${reveal?'<button class="button text-button" data-action="toggle-result-details">Свернуть разборы</button>':''}</div><div class="review-filters" role="group" aria-label="Какие задания показать"><button class="button secondary" data-review-filter="all" aria-pressed="true">Все · ${a.questions.length}</button><button class="button secondary" data-review-filter="review" aria-pressed="false">${r.pending?'Требуют внимания':'С ошибками'} · ${reviewCount}</button></div><p class="tiny muted">${reveal?'Все решения открыты ниже. Выберите номер, чтобы перейти к нужному разбору.':'Выберите номер, чтобы посмотреть свой ответ.'}</p><div class="result-nav-grid">${a.questions.map((q,i)=>{const status=resultStatus(a.responses[q.id]||{});return `<button class="${status.kind}" data-result-question="${i}" aria-label="Задание ${i+1}: ${status.label}"><span>${i+1}</span><span aria-hidden="true">${status.symbol}</span></button>`;}).join('')}</div></section>
  <p class="notice" id="review-empty" role="status" hidden>Ошибок нет. Все задания выполнены верно — можно изучить решения во вкладке «Все».</p>
  <div class="result-list">${a.questions.map((q,i)=>resultQuestionMarkup(q,i,a,reveal)).join('')}</div>`;
}
function filterResults(filter){
  if(state.attempt?.phase!=='finished')return;
  const review=filter==='review';let count=0;
  document.querySelectorAll('.result-question').forEach(card=>{card.hidden=review&&card.dataset.resultStatus==='good';if(!card.hidden)count++;});
  document.querySelectorAll('[data-review-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reviewFilter===(review?'review':'all'))));
  document.querySelectorAll('[data-result-question]').forEach(button=>{const card=document.getElementById(`result-question-${button.dataset.resultQuestion}`);button.hidden=Boolean(card?.hidden);});
  if($('#review-empty'))$('#review-empty').hidden=count!==0;
  syncResultToggle();
}
function syncResultToggle(){
  const button=$('[data-action="toggle-result-details"]');if(!button)return;
  const cards=[...document.querySelectorAll('.result-question:not([hidden])')];
  button.disabled=!cards.length;
  button.textContent=cards.length&&cards.every(card=>card.open)?'Свернуть разборы':'Раскрыть разборы';
}
function toggleResultDetails(){
  const cards=[...document.querySelectorAll('.result-question:not([hidden])')],expand=!cards.every(card=>card.open);
  cards.forEach(card=>card.open=expand);
  syncResultToggle();
}
function renderHistory(){
  $('#main').innerHTML=`${activeBanner()}<span class="eyebrow">ЛОКАЛЬНЫЙ АРХИВ</span><h1>Мои работы</h1><p class="muted">История в этом браузере. Скачивайте важные работы перед очисткой данных.</p>${state.entries.length?`<div class="history-list">${[...state.entries].sort((a,b)=>b.startedAt-a.startedAt).map(a=>`<article class="history-row"><div><h3>${esc(a.topicTitle)}</h3><p>${esc(a.studentName)} · ${esc(a.schoolClass)} · ${date(a.startedAt)}</p><p>${a.source==='practice'?'Работа над ошибками':modeName(a.mode)}${a.seriesId?' · вариант '+esc(a.variant):''}${a.difficulty?' · '+esc(difficultyName(a.difficulty)):''} · ${a.phase==='finished'?(a.result?.mark?'оценка '+a.result.mark:'ожидает проверки'):'не завершена'}</p></div><div class="history-actions"><button class="button secondary" data-open-attempt="${a.id}">${a.phase==='finished'?'Открыть':'Продолжить'}</button><button class="icon-button" data-delete-attempt="${a.id}" aria-label="Удалить работу">×</button></div></article>`).join('')}</div>`:'<div class="empty-state"><h2>Здесь будут ваши решения</h2><p class="muted">Выполните первую тренировку — она сохранится автоматически.</p><button class="button primary" data-screen="home">Выбрать задания →</button></div>'}`;
}
function renderAbout(){
  $('#main').innerHTML=`${activeBanner()}<span class="eyebrow">КОД [1430]</span><h1>Понять. Решить. Проверить.</h1><p class="muted">Учебное пространство по информатике школы №1430 для 7–11 классов.</p><div class="about-grid"><article class="about-card"><h2>От задачи к результату</h2><p>Выберите класс, тему и формат. В тренировке доступны проверка и объяснения. В контроле ответы проверяются после сдачи. После получения оценки в обоих режимах открываются правильные ответы, пошаговые решения и напутствие по результату.</p><p>Готовая работа содержит условия, ваши ответы, баллы и оценку. Скачайте PDF или PNG и прикрепите к дневнику вручную.</p></article><article class="about-card"><h2>Ваши данные — на устройстве</h2><p>Регистрации нет. Имя, класс, ответы и история сохраняются в браузере. Они не отправляются на сервер. Очистка данных браузера удалит историю.</p><p>Важные результаты сохраняйте отдельным файлом. На другом устройстве локальная история не появится.</p></article><article class="about-card"><h2>Что означает контроль</h2><p>Таймер продолжает идти при скрытии страницы и перезагрузке. Журнал фиксирует скрытия страницы, возвращения и их длительность. В строгом режиме третье скрытие завершает работу.</p><p>Браузер не может полностью заблокировать другие вкладки и приложения. Журнал и ответы хранятся на устройстве и могут быть изменены через инструменты разработчика. Это учебный контроль, а не защищённый экзамен.</p></article><article class="about-card"><h2>Python и калькулятор</h2><p>Python работает локально в отдельном потоке. Используйте условия, циклы, функции, строки и списки. Импорты, чтение файлов и дополнительные библиотеки в редакторе отключены.</p><p>Один input() читает одну строку из поля входных данных. Запуск ограничен 5 секундами и 16 000 символов вывода. Автопроверка — 3 секунды и 8 000 символов на тест.</p></article><article class="about-card"><h2>Как выставляется оценка</h2><p>По умолчанию: 5 — от 85%, 4 — от 70%, 3 — от 50%, 2 — менее 50%. В конструкторе можно задать другие пороги; они показываются до начала и сохраняются в отчёте. Оценка считается по баллам до округления процентов. За программу возможен частичный балл по числу пройденных тестов.</p><p>События контроля отражаются отдельно и не снижают балл за знания. Сбой загрузки Python оставляет итоговую оценку незавершённой.</p></article><article class="about-card"><h2>Задания и варианты</h2><p>${BANK_STATS.templates} авторских шаблонов в ${BANK_STATS.topics} темах — по ${BANK_STATS.templates/BANK_STATS.grades} на каждый класс. Три уровня сложности и смешанная работа от простого к сложному. Варианты 1–30 одного набора при одинаковых настройках сохраняют структуру и баллы. Это учебный банк, а не официальные КИМ и не полная программа ОГЭ или ЕГЭ.</p><p>В «Конструкторе» можно собрать до 30 заданий из банка, изменить порядок и баллы, настроить шкалу оценки, сохранить шаблон и посмотреть варианты. Редактирование шаблона не меняет уже выданные ссылки.</p><p>«Работа по ссылке» позволяет выдать конкретный вариант с заданными правилами или скачать 30 ссылок. После сдачи кнопка «Работа над ошибками» создаёт отдельную тренировку по непройденным заданиям.</p><p>Версия банка: ${esc(BANK_VERSION)}. Интерпретатор: Pyodide 314.0.7 / Python 3.14.2. Для первого открытия и загрузки Python нужен интернет.</p></article></div>`;
}
function getEngine(){return state.engine||(state.engine=new PythonEngine());}
function contextResponse(){if(!state.attempt)return null;return state.toolContext?state.attempt.responses[state.toolContext]:state.attempt.scratch;}
function syncEditor(){
  const r=contextResponse();if(!r||!canEdit())return;
  const changed=r.code!==$('#python-code').value||r.stdin!==$('#python-input').value;
  r.code=$('#python-code').value;r.stdin=$('#python-input').value;
  if(changed){r.output='';r.error=null;r.lastRunAt=null;r.lastRunCode=null;r.lastRunInput=null;pythonHighlight.setErrorLine(null);r.checked=false;r.correct=null;r.score=0;r.gradingUnavailable=false;$('#python-output').textContent='Код изменён. Запустите программу.';}
  persist();
}
function lineNumbers(){pythonHighlight.refresh();const count=$('#python-code').value.split('\n').length;$('#python-lines').textContent=Array.from({length:count},(_,i)=>i+1).join('\n');$('#python-lines').scrollTop=$('#python-code').scrollTop;}
function openTool(name,questionId=null){
  if(!canEdit()||state.grading)return;const a=state.attempt;if(!a.tools[name]){toast('Этот инструмент отключён правилами работы.');return;}
  if(!$('#tools-dialog').open){state.toolContext=questionId;const r=contextResponse();$('#python-code').value=r?.code||'';$('#python-input').value=r?.stdin||'';$('#python-output').textContent=r?.error?`${r.output||''}\n${r.error}`:r?.output||'Здесь появится результат.';lineNumbers();pythonHighlight.setErrorLine(Number(r?.error?.match(/^Строка (\d+):/)?.[1])||null);}
  document.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=!a.tools[b.dataset.tool];b.setAttribute('aria-pressed',String(b.dataset.tool===name));});
  $('#calculator-panel').hidden=name!=='calculator';$('#python-panel').hidden=name!=='python';
  $('#python-context').textContent=state.toolContext?'Код из этого редактора будет ответом на текущее задание.':'Черновик. Этот код не является ответом на задание.';
  if(!$('#tools-dialog').open)$('#tools-dialog').showModal();(name==='python'?$('#python-code'):$('#calc-expression')).focus();
}
function closeTools(){if(state.running)state.engine?.stop();syncEditor();$('#tools-dialog').close();if(state.screen==='work'&&active())renderWork();}
async function runPython(){
  if(!canEdit()||state.running||state.grading||!state.attempt.tools.python)return;syncEditor();const a=state.attempt,r=contextResponse();if(!r)return;const runToken=++state.pythonRunToken;
  state.running=true;$('#python-run').disabled=true;$('#python-stop').disabled=false;$('#python-code').readOnly=true;$('#python-input').readOnly=true;$('#python-output').textContent='';
  const runCode=r.code,runInput=r.stdin,runContext=state.toolContext;
  const ownsConsole=()=>runToken===state.pythonRunToken&&a===state.attempt&&runContext===state.toolContext;
  const result=await getEngine().run(runCode,runInput,{onOutput:chunk=>{if(ownsConsole())$('#python-output').textContent+=chunk;},onStatus:status=>{if(ownsConsole())$('#python-status').textContent={loading:'Подготавливаем Python…',running:'Программа выполняется…',idle:'Готово'}[status];}});
  if(runToken!==state.pythonRunToken)return;
  state.running=false;$('#python-run').disabled=false;$('#python-stop').disabled=true;$('#python-code').readOnly=false;$('#python-input').readOnly=false;
  if(runToken!==state.pythonRunToken||a!==state.attempt||a.phase!=='active')return;
  r.output=result.output;r.error=result.error;r.lastRunAt=Date.now();r.lastRunCode=runCode;r.lastRunInput=runInput;
  if(ownsConsole()){pythonHighlight.setErrorLine(Number(result.error?.match(/^Строка (\d+):/)?.[1])||null);$('#python-output').textContent=`${result.output}${result.error?'\n'+result.error:''}`||'(пустой вывод)';
  $('#python-status').textContent=result.error?'Выполнение завершено с сообщением':`Готово · ${result.durationMs} мс`;}
  if(a===state.attempt)persist();
}
function computeCalculator(){try{const value=calculate($('#calc-expression').value);$('#calc-result').textContent=formatCalculator(value);$('#calc-result').classList.remove('error');return true;}catch(e){$('#calc-result').textContent=e.message;$('#calc-result').classList.add('error');return false;}}
function calculatorKey(key){
  const input=$('#calc-expression');if(key==='C'){input.value='';$('#calc-result').textContent='0';$('#calc-result').classList.remove('error');}
  else if(key==='⌫'){const i=input.selectionStart,j=input.selectionEnd;input.setRangeText('',i===j?Math.max(0,i-1):i,j,'end');}
  else if(key==='=')computeCalculator();else input.setRangeText(key,input.selectionStart,input.selectionEnd,'end');input.focus();
}
function buildReport(a){
  const c=conductSummary(a);return {appName:'Код 1430',studentName:a.studentName,schoolClass:a.schoolClass,grade:a.grade,topicTitle:a.topicTitle,workTitle:a.workTitle||'',difficultyTitle:a.difficulty?difficultyName(a.difficulty):'',seriesId:a.seriesId||'',sourceAttemptId:a.sourceAttemptId,sourceVariant:a.sourceVariant,variant:variantLabel(a),mode:a.mode,profileTitle:a.profileTitle,gradingScale:gradeScaleText(a.thresholds),constructorWorkId:a.constructorWorkId,constructorRevision:a.constructorRevision,attemptId:a.id,startedAt:a.startedAt,finishedAt:a.finishedAt,elapsedSeconds:Math.max(0,(a.finishedAt-a.startedAt)/1000),...a.result,finishReason:a.finishReason,policySummary:policyText(a),tools:a.tools,events:a.events,hiddenCount:c.departures,hiddenTotalMs:c.durationMs,includeSolutions:canShowSolutions(a),motivation:resultFeedback(a.result),questions:a.questions.map(q=>{const r=a.responses[q.id];return {...q,solutionSteps:solutionSteps(q),studentAnswer:q.kind==='program'?r.code:r.text,score:r.score||0,correct:r.correct,programCode:r.code,programInput:r.lastRunAt?r.lastRunInput:undefined,programOutput:r.lastRunAt?r.output:undefined,programError:r.error,programOutputTruncated:Boolean(r.error?.startsWith('Слишком большой вывод.'))};})};
}
async function openExport(){
  if(state.attempt?.phase!=='finished')return;state.exportAttempt=structuredClone(state.attempt);state.pages=[];
  $('#export-status').textContent='Подготавливаем страницы…';$('#export-controls').hidden=true;$('#export-preview').replaceChildren();$('#export-dialog').showModal();
  try{state.pages=await renderReportPages(buildReport(state.exportAttempt));$('#export-page').innerHTML=state.pages.map((_,i)=>`<option value="${i}">${i+1} / ${state.pages.length}</option>`).join('');$('#export-controls').hidden=false;$('#export-status').textContent=`Работа готова · страниц: ${state.pages.length}. PDF содержит всю работу; PNG — выбранную страницу.`;previewPage();}
  catch(e){$('#export-status').textContent='Не удалось подготовить файл. Попробуйте экспорт в другом современном браузере. '+e.message;}
}
function previewPage(){const page=state.pages[Number($('#export-page').value)||0];if(page)$('#export-preview').replaceChildren(page.canvas);}
function exportName(){const a=state.exportAttempt;return safeFilename(`Код1430_${a.schoolClass}_${a.studentName}_${a.variant}`);}
function tick(){
  const a=state.attempt;if(!a||a.phase!=='active')return;
  if(deadlinePassed(a)){finishAttempt('Время истекло',a.endAt);return;}
  const remaining=Math.max(0,Math.ceil((a.endAt-Date.now())/1000)),elapsed=Math.floor((Date.now()-a.startedAt)/1000);
  if($('#work-timer')){$('#work-timer').textContent=formatDuration(a.mode==='control'?remaining:elapsed);$('#work-timer').classList.toggle('urgent',a.mode==='control'&&remaining<=60);}
}
function onHidden(){
  if(!active()||state.attempt.mode!=='control')return;
  const a=state.attempt;if(deadlinePassed(a)){finishAttempt('Время истекло',a.endAt);return;}
  if(hideAttempt(a)){persist(true);if(a.strict&&conductSummary(a).departures>=STRICT_LIMIT)finishAttempt(`Достигнут лимит скрытий страницы: ${STRICT_LIMIT}`);}
}
function onVisible(){
  if(!active())return;const a=state.attempt,returned=showAttempt(a,a.mode==='control'?Math.min(Date.now(),a.endAt):Date.now());if(returned){if(deadlinePassed(a))returned.label='Учёт отсутствия завершён по таймеру';persist(true);}
  if(deadlinePassed(a)){finishAttempt('Время истекло',a.endAt);return;}
  if(!returned||a.mode!=='control')return;const c=conductSummary(a);
  if(a.strict&&c.departures>=STRICT_LIMIT){finishAttempt(`Достигнут лимит скрытий страницы: ${STRICT_LIMIT}`);return;}
  $('#away-message').textContent=`Страница была скрыта ${formatDuration(returned.durationMs/1000)}. Всего скрытий: ${c.departures}${a.strict?' из '+STRICT_LIMIT:''}. Событие добавлено в журнал.`;
  if(!$('#away-dialog').open)$('#away-dialog').showModal();if($('#conduct-count'))$('#conduct-count').textContent=`Скрытий страницы: ${c.departures}${a.strict?' / '+STRICT_LIMIT:''}`;
}
async function restoreAttempt(a){
  state.attempt=structuredClone(a);state.toolContext=null;
  if(a.phase==='finished'){showScreen('result');return;}
  if(a.phase==='grading'){const restored=state.attempt;state.grading=true;showScreen('work');await persist(true);if(restored===state.attempt)await performGrading(restored);return;}
  if(a.mode==='control')event(state.attempt,'reload','Попытка восстановлена');
  showScreen('work');if(document.hidden)onHidden();else onVisible();await persist(true);
}

const actions={
  help:()=>showScreen('about'),'toggle-result-details':toggleResultDetails,'prepare-start':()=>prepareStart(),'prepare-share':prepareShare,'copy-share':copyShare,'download-variants':downloadVariants,'close-share':()=>$('#share-dialog').close(),'leave-assignment':leaveAssignment,'practice-mistakes':prepareMistakes,'new-series':()=>{state.prefs.seed=randomSeed();state.prefs.variant=1;savePreferences(state.prefs);renderHome();},resume:()=>showScreen('work'),previous:()=>move(-1),next:()=>move(1),'check-answer':checkCurrent,'ask-finish':askFinish,
  'open-calculator':()=>openTool('calculator'),'open-python':()=>openTool('python',state.attempt?.questions[state.attempt.currentIndex]?.kind==='program'?state.attempt.questions[state.attempt.currentIndex].id:null),'open-program':()=>openTool('python',state.attempt.questions[state.attempt.currentIndex].id),
  'close-tools':closeTools,'run-python':runPython,'stop-python':()=>state.engine?.stop(),'clear-python-output':()=>{if(state.running)return;const r=contextResponse();if(r){r.output='';r.error=null;r.lastRunAt=null;persist();}pythonHighlight.setErrorLine(null);$('#python-output').textContent='Вывод очищен.';},
  'copy-calculator':async()=>{if(!computeCalculator())return;try{await navigator.clipboard.writeText($('#calc-result').textContent);toast('Результат скопирован');}catch{toast('Копирование недоступно. Выделите результат вручную.');}},
  export:openExport,'close-export':()=>$('#export-dialog').close(),'download-pdf':()=>{if(state.pages.length)downloadBlob(createPdf(state.pages),exportName()+'.pdf');},
  'download-png':async()=>{if(state.pages.length)await downloadPngPage(state.pages[Number($('#export-page').value)||0],exportName()+`_стр${Number($('#export-page').value)+1}.png`);},
  'download-all-png':async()=>{if(state.pages.length)downloadBlob(await createPngZip(state.pages,exportName()),exportName()+'_PNG.zip');},
  'new-work':()=>{state.attempt=null;showScreen('home');},'retry-grading':async()=>{if(state.grading)return;const a=state.attempt;state.grading=true;a.phase='grading';showScreen('work');await persist(true);if(a===state.attempt)await performGrading(a);}
};
function revealQuestion(){const heading=$('#question-title');heading?.focus({preventScroll:true});document.documentElement.scrollTop=0;document.body.scrollTop=0;}
function move(delta){if(!active()||state.grading)return;state.attempt.currentIndex=Math.max(0,Math.min(state.attempt.questions.length-1,state.attempt.currentIndex+delta));persist();renderWork();revealQuestion();}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  try{
    if(b.dataset.screen){if(state.grading){toast('Дождитесь окончания проверки.');return;}showScreen(b.dataset.screen);}
    else if(b.hasAttribute('data-copy-code')){const code=b.closest('.source-code')?.querySelector('pre code')?.textContent;if(code==null)return;try{await navigator.clipboard.writeText(code);toast('Код скопирован');}catch{toast('Копирование недоступно. Выделите код и скопируйте его вручную.');}}
    else if(b.dataset.reviewFilter)filterResults(b.dataset.reviewFilter);
    else if(b.dataset.resultQuestion!=null){const card=document.getElementById(`result-question-${b.dataset.resultQuestion}`);if(card){card.open=true;syncResultToggle();card.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});card.querySelector('summary')?.focus({preventScroll:true});}}
    else if(b.dataset.grade){state.prefs.grade=Number(b.dataset.grade);state.prefs.topicId='all';savePreferences(state.prefs);renderHome();}
    else if(b.dataset.topic){state.prefs.topicId=b.dataset.topic;if(state.prefs.profileId==='final'&&b.dataset.topic!=='all')state.prefs.profileId='thematic';savePreferences(state.prefs);renderHome();}
    else if(b.dataset.mode){state.prefs.mode=b.dataset.mode;savePreferences(state.prefs);renderHome();}
    else if(b.dataset.question!=null){if(!active()||state.grading)return;state.attempt.currentIndex=Number(b.dataset.question);persist();renderWork();revealQuestion();}
    else if(b.dataset.tool)openTool(b.dataset.tool);
    else if(b.dataset.calc)calculatorKey(b.dataset.calc);
    else if(b.dataset.openAttempt){const a=state.entries.find(x=>x.id===b.dataset.openAttempt);if(active()&&state.attempt.id===a.id){showScreen('work');return;}if(active()&&state.attempt.id!==a.id){toast('Сначала завершите текущую работу.');return;}await restoreAttempt(a);}
    else if(b.dataset.deleteAttempt){const id=b.dataset.deleteAttempt;if(active()&&state.attempt.id===id){toast('Сначала завершите эту работу.');return;}if(await confirmAction('Удалить работу?','Локальная запись будет удалена. Скачанные файлы сохранятся.','Удалить')){await deleteAttempt(id);state.entries=state.entries.filter(a=>a.id!==id);if(state.attempt?.id===id)state.attempt=null;$('#history-count').textContent=state.entries.length;renderHistory();}}
    else if(b.dataset.action)await actions[b.dataset.action]?.();
  }catch(error){toast('Не удалось выполнить действие: '+error.message);}
});
document.addEventListener('toggle',e=>{if(e.target.matches?.('.result-question'))syncResultToggle();},true);
document.addEventListener('submit',async e=>{if(['student-form','share-form'].includes(e.target.id)){e.preventDefault();try{if(e.target.id==='student-form')await startAttempt(e.target);else createShareLinks(e.target);}catch(error){toast(error.message);}}});
document.addEventListener('change',e=>{
  if(e.target.closest('#share-form')&&$('#share-result'))$('#share-result').hidden=true;
  if(e.target.id==='profile-select'){state.prefs.profileId=e.target.value;savePreferences(state.prefs);renderHome();}
  else if(e.target.id==='difficulty-select'){state.prefs.difficulty=e.target.value;savePreferences(state.prefs);renderHome();}
  else if(e.target.id==='variant-select'){state.prefs.variant=Number(e.target.value);savePreferences(state.prefs);renderHome();}
  else if(e.target.id==='strict-select'){state.prefs.strict=e.target.value==='yes';savePreferences(state.prefs);renderHome();}
  else if(e.target.name==='answer')updateResponse(e.target.value);
  else if(e.target.id==='export-page')previewPage();
});
document.addEventListener('input',e=>{if(e.target.closest('#share-form')&&$('#share-result'))$('#share-result').hidden=true;if(e.target.id==='answer-input')updateResponse(e.target.value);if(['python-code','python-input'].includes(e.target.id)){syncEditor();lineNumbers();}});
$('#python-code').addEventListener('keydown',e=>{
  if(e.target.readOnly)return;
  if(e.key==='Tab'){e.preventDefault();e.target.setRangeText('    ',e.target.selectionStart,e.target.selectionEnd,'end');syncEditor();lineNumbers();}
  else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();runPython();}
  else if(e.key==='Enter'){e.preventDefault();const before=e.target.value.slice(0,e.target.selectionStart).split('\n').at(-1);const indent=before.match(/^\s*/)[0]+(before.trimEnd().endsWith(':')?'    ':'');e.target.setRangeText('\n'+indent,e.target.selectionStart,e.target.selectionEnd,'end');syncEditor();lineNumbers();}
});
$('#python-code').addEventListener('scroll',()=>$('#python-lines').scrollTop=$('#python-code').scrollTop);
$('#calc-expression').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();computeCalculator();}});
$('#calc-keys').innerHTML=['C','(',')','⌫','/','7','8','9','%','*','4','5','6','^','-','1','2','3','//','+','0','.','00','**','='].map(k=>`<button class="calc-key ${k==='='?'equal':/[0-9.]/.test(k)?'':'operator'}" data-calc="${k}" aria-label="${k==='⌫'?'Удалить символ':k==='C'?'Очистить':k}">${k}</button>`).join('');
$('#confirm-ok').addEventListener('click',()=>resolveConfirm(true));$('#confirm-cancel').addEventListener('click',()=>resolveConfirm(false));$('#confirm-dialog').addEventListener('cancel',()=>resolveConfirm(false));
$('#away-continue').addEventListener('click',()=>$('#away-dialog').close());
$('#tools-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTools();});
document.addEventListener('visibilitychange',()=>document.hidden?onHidden():onVisible());
document.addEventListener('fullscreenchange',()=>{if(active()&&state.attempt.mode==='control'){event(state.attempt,document.fullscreenElement?'fullscreen_enter':'fullscreen_exit',document.fullscreenElement?'Полноэкранный режим включён':'Выход из полноэкранного режима');persist();}});
window.addEventListener('pagehide',onHidden);
window.addEventListener('beforeunload',e=>{if(active()||state.attempt?.phase==='grading'){checkpoint(state.attempt);e.preventDefault();e.returnValue='';}});
window.addEventListener('pageshow',e=>{if(e.persisted)onVisible();});
onStorageError(message=>toast(message));
onAttemptConflict(handleAttemptConflict);
window.addEventListener('storage',e=>{if(e.key?.startsWith('code1430:')&&e.key!=='code1430:preferences'&&state.attempt)void syncAttempt(state.attempt);});
window.addEventListener('hashchange',()=>{readSharedWork();state.draft=null;$('#start-dialog').close();if(active()||state.grading){toast('Ссылка подготовлена. Текущая работа продолжается.');}else showScreen('home');});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView?.({block:'start'});});
async function init(){
  readSharedWork();savePreferences(state.prefs);
  state.entries=await listAttempts();$('#history-count').textContent=state.entries.length;
  const unfinished=state.entries.find(a=>a.phase==='active'||a.phase==='grading');
  if(unfinished)await restoreAttempt(unfinished);else showScreen('home',{focus:false});
  setInterval(tick,1000);
}
init().catch(error=>{$('#main').innerHTML=`<div class="notice error"><h2>Не удалось открыть тренажёр</h2><p>${esc(error.message)}</p><p>Обновите страницу. Проверьте, что загружены все файлы проекта.</p></div>`;});
