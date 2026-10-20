import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {generateQuestions,BANK_VERSION,TEMPLATE_CATALOG} from '../js/bank.js';
import {resultFeedback} from '../js/solutions.js';
import {buildReportLayout} from '../js/export.js';

test('after submission every final grade opens all solutions and its own encouragement',async t=>{
  const root=new URL('../',import.meta.url),dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://school.example/code-1430/',pretendToBeVisual:true});
  const old=new Map(),timers=new Set(),copied=[],originalTimeout=globalThis.setTimeout;
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:{clipboard:{writeText:async text=>copied.push(text)}},localStorage:dom.window.localStorage,indexedDB:undefined,setInterval:()=>0,setTimeout:(fn,delay,...args)=>{const timer=originalTimeout(fn,delay,...args);timers.add(timer);return timer;}})){old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
  try{
    const url=new URL('js/app.js',root);let source=await readFile(url,'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,url).href}'`);source+='\nexport const feedbackApi={state,prepareStart,startAttempt,finishAttempt,renderResult,buildReport};';
    const {feedbackApi:api}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);await flush();
    for(const mode of ['control','training'])for(const [mark,correctSlots] of [[2,[]],[3,[2]],[4,[0,2]],[5,[0,1,2]]])await t.test(`${mode}: mark ${mark}`,async()=>{
      api.state.attempt=null;const questions=generateQuestions({grade:8,templateIds:['g8-bases-binary','g8-bases-octal','g8-bases-tobinary'],seed:1430}).map((q,i)=>({...q,points:[2,3,5][i]}));
      api.prepareStart({config:{bankVersion:BANK_VERSION,grade:8,topicId:'g8-bases',profileId:'quick',mode,strict:false,minutes:12,difficulty:'mixed',seed:1430,variant:1,title:'Проверка разбора'},questions,tools:{calculator:true,python:true},topicTitle:'Системы счисления',profileTitle:'Проверка'});
      document.querySelector('#student-name').value='Ученик 1430';document.querySelector('#student-class').value='8А';await api.startAttempt(document.querySelector('#student-form'));
      assert.equal(document.querySelector('.solution-walkthrough'),null,'no answers in active work');assert.equal(document.querySelector('.result-feedback'),null);
      const a=api.state.attempt;for(const i of correctSlots)a.responses[a.questions[i].id].text=a.questions[i].answer;
      await api.finishAttempt();assert.equal(a.result.mark,mark);
      assert.equal(document.querySelectorAll('.solution-walkthrough').length,3);assert.equal(document.querySelectorAll('.result-question[open]').length,3);
      assert.equal(document.querySelector('.result-feedback').dataset.feedbackMark,String(mark));assert.ok(document.querySelector('.result-feedback').textContent.includes(resultFeedback(a.result).quote));
      assert.ok([...document.querySelectorAll('.solution-walkthrough ol')].every(node=>node.children.length>=2));
      for(const [i,card] of [...document.querySelectorAll('.result-question')].entries()){
        assert.equal(card.querySelector('.student-answer-panel p').textContent,correctSlots.includes(i)?String(a.questions[i].answer):'Ответ не указан');
        assert.equal(card.querySelector('.correct-answer-panel p').textContent,String(a.questions[i].answer));
      }
      const before=JSON.stringify(a);const report=api.buildReport(a);assert.equal(report.includeSolutions,true);assert.equal(report.motivation.mark,mark);
      const text=buildReportLayout(report).pages.flatMap(p=>p.commands).map(c=>c.text||'').join('\n');assert.ok(text.includes('Разбор после выполнения'));assert.ok(text.includes(report.motivation.quote));
      api.renderResult();assert.equal(JSON.stringify(a),before,'viewing solutions does not overwrite answers or mark');
    });
    await t.test('result filters and numbered navigation preserve answers and the grade',async()=>{
      const a=api.state.attempt,q=a.questions[0],r=a.responses[q.id];
      r.correct=false;r.score=0;api.renderResult();const before=JSON.stringify(a);
      document.querySelector('[data-review-filter="review"]').click();
      assert.equal(document.querySelectorAll('.result-question:not([hidden])').length,1);
      assert.equal(document.querySelectorAll('[data-result-question]:not([hidden])').length,1);
      assert.equal(document.querySelector('[data-review-filter="review"]').getAttribute('aria-pressed'),'true');
      document.querySelector('[data-action="toggle-result-details"]').click();
      assert.equal(document.querySelector('#result-question-0').open,false);
      document.querySelector('[data-result-question="0"]').click();
      assert.equal(document.querySelector('#result-question-0').open,true);
      assert.equal(document.querySelector('[data-action="toggle-result-details"]').textContent,'Свернуть разборы');
      document.querySelector('[data-review-filter="all"]').click();
      assert.equal(document.querySelectorAll('.result-question:not([hidden])').length,3);
      document.querySelector('[data-action="toggle-result-details"]').click();
      assert.equal(document.querySelectorAll('.result-question[open]').length,0);
      document.querySelector('[data-action="toggle-result-details"]').click();
      assert.equal(document.querySelectorAll('.result-question[open]').length,3);
      assert.equal(JSON.stringify(a),before);
      r.correct=true;r.score=q.points;api.renderResult();
      document.querySelector('[data-review-filter="review"]').click();
      assert.equal(document.querySelector('#review-empty').hidden,false);
      assert.equal(document.querySelector('[data-action="toggle-result-details"]').disabled,true);
      assert.equal(document.querySelectorAll('.result-question:not([hidden])').length,0);
      document.querySelector('[data-review-filter="all"]').click();
      assert.equal(document.querySelector('#review-empty').hidden,true);
    });
    await t.test('pending grade hides explanations and encouragement until retry succeeds',async()=>{
      const a=api.state.attempt;a.result.pending=1;a.result.mark=null;api.renderResult();assert.equal(document.querySelector('.solution-walkthrough'),null);assert.equal(document.querySelector('.correct-answer-panel'),null);assert.equal(document.querySelector('.result-feedback'),null);assert.equal(api.buildReport(a).includeSolutions,false);
      a.result.pending=0;a.result.mark=5;api.renderResult();assert.equal(document.querySelectorAll('.solution-walkthrough').length,3);
    });
    await t.test('answer progress updates without replacing the focused input',async()=>{
      api.state.attempt=null;
      const questions=generateQuestions({grade:8,templateIds:['g8-bases-binary','g8-bases-octal'],seed:1430});
      api.prepareStart({config:{bankVersion:BANK_VERSION,grade:8,topicId:'g8-bases',profileId:'quick',mode:'control',strict:false,minutes:12,difficulty:'mixed',seed:1430,variant:1},questions,tools:{calculator:true,python:true},topicTitle:'Системы счисления',profileTitle:'Проверка'});
      document.querySelector('#student-name').value='Ученик';document.querySelector('#student-class').value='8А';await api.startAttempt(document.querySelector('#student-form'));
      const input=document.querySelector('#answer-input');input.focus();input.value='12';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      assert.equal(document.querySelector('#work-progress').value,1);assert.equal(document.querySelector('#work-progress').max,2);
      assert.equal(document.querySelector('#work-progress-label').textContent,'1 из 2');
      assert.equal(document.querySelector('#answer-input'),input);assert.equal(document.activeElement,input);
      input.value='';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
      assert.equal(document.querySelector('#work-progress').value,0);assert.equal(document.querySelector('.solution-walkthrough'),null);
      assert.equal(document.querySelector('.correct-answer-panel'),null);await api.finishAttempt();
    });
    await t.test('result uses formatted conditions and copies the exact submitted Python source',async()=>{
      const generated=TEMPLATE_CATALOG.map(row=>generateQuestions({grade:row.grade,templateIds:[row.id],seed:1430,variant:7})[0]);
      const questions=[generated.find(q=>q.prompt.includes(' | ')),generated.find(q=>q.kind==='program'),generated.find(q=>q.code)];
      assert.ok(questions.every(Boolean));
      const a=api.state.attempt,source='for i in range(2):\n    print(i)\n# <tag> & spaces\n';
      a.questions=questions;a.responses=Object.fromEntries(questions.map(q=>[q.id,{text:'',code:q.kind==='program'?source:'',score:0,correct:false}]));api.renderResult();
      assert.ok(document.querySelector('.result-body .prompt-table'));
      assert.equal(document.querySelectorAll('.result-body .prompt-sample').length,2);
      assert.equal(document.querySelector('.student-answer-panel .source-code code').textContent,source);
      document.querySelector('.student-answer-panel [data-copy-code]').click();await flush();assert.equal(copied.at(-1),source);
      assert.equal(document.querySelector('#result-question-2 .source-code code').textContent,questions[2].code);
      assert.ok(document.querySelector('#result-question-1 .solution-walkthrough .source-code'));
    });
  }finally{for(const timer of timers)clearTimeout(timer);dom.window.close();for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
