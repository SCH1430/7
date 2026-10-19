// Integration coverage for the approved focus interface. Uses real tasks and saved attempts.
const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),C=require('../dist/bank.js');
const root=path.resolve(__dirname,'..'),mainKey='1430.practicum.v1.active',ogeKey='1430.oge.v1.active';
const saved=(p,key)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function noOverflow(p,label){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label);}
async function shot(p,name,fullPage=false){await p.locator('#toast.show').waitFor({state:'hidden'});await p.screenshot({path:path.join(root,'output',name+'.png'),fullPage});}
async function mainMap(p,index){await p.locator('[data-action=exam-map]').click();await p.locator('.task-nav [data-index="'+index+'"]').click();}
async function ogeMap(p,index){await p.locator('[data-do=task-map]').click();await p.locator('.task-nav [data-index="'+index+'"]').click();}
async function dialogKeyboard(p,trigger,closeSelector){
  await p.locator(trigger).click();await p.locator('[role=dialog]').waitFor();await p.keyboard.press('Shift+Tab');
  assert.equal(await p.locator(closeSelector).evaluate(el=>el===document.activeElement),true,'Shift+Tab from dialog reaches its last action');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator(trigger).evaluate(el=>el===document.activeElement),true,'Escape restores focus to the opener');
  assert.equal(await p.locator('#app').evaluate(el=>el.inert),false);
}
(async()=>{
  await fs.mkdir(path.join(root,'output'),{recursive:true});
  const {createServer}=await import('../server.mjs'),server=createServer({basePath:'/school1430-trainer/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/school1430-trainer/';
  let browser;
  try {
    browser=await chromium.launch(launchOptions);
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),p=await context.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto(url);await shot(p,'focus-home-desktop',true);await noOverflow(p,'desktop home');
    for(const size of [{width:390,height:844},{width:320,height:740}]){
      await p.setViewportSize(size);await noOverflow(p,'home '+size.width);
    }
    await p.setViewportSize({width:390,height:844});await shot(p,'focus-home-mobile',true);await p.setViewportSize({width:1440,height:1000});
    await p.locator('.topbar [data-action=builder]').click();
    const table=C.bank.find(b=>b.task.body.includes('<table')),taskIds=['advanced-9','base-13','advanced-13','base-15','advanced-4',...(table?[table.id]:[])];
    const variant={kind:'1430-variant',schema:1,title:'Проверка рабочего листа',minutes:20,taskIds};
    await p.locator('#variant-file').setInputFiles({name:'focus-variant.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(variant))});
    await p.locator('.selected-tasks li').nth(taskIds.length-1).waitFor();assert.equal(await p.locator('.selected-tasks li').count(),taskIds.length);
    await shot(p,'focus-builder-desktop',true);
    await p.locator('[name=student]').fill('Проверка интерфейса');await p.locator('[name=schoolClass]').fill('7 А');
    await p.locator('#builder-form button[type=submit]').click();await p.locator('[data-action=start]').click();await p.locator('.focus-sheet').waitFor();
    assert.equal(await p.evaluate(()=>!!document.fullscreenElement),true);
    await p.locator('[data-field="0"]').fill(C.bank.find(b=>b.id===taskIds[0]).task.fields[0].correct);
    await p.locator('[data-action=flag]').click();
    assert.equal(await p.locator('[data-action=skip]').isHidden(),true);
    await shot(p,'focus-main-desktop',true);
    await dialogKeyboard(p,'[data-action=exam-map]','.modal [data-action=confirm-finish]');
    await p.locator('[data-action=exam-map]').click();
    assert.equal(await p.locator('.task-number.answered.flagged').count(),1);
    await p.locator('.task-nav [data-index="1"]').click();
    await p.locator('[data-action=next]').click();
    assert.equal((await saved(p,mainKey)).current,1,'next keeps the original complete-answer guard');
    assert.match(await p.locator('#toast').innerText(),/Пропустить/);
    await p.locator('[data-action=skip]').click();assert.equal((await saved(p,mainKey)).current,2);
    assert.equal(await p.locator('.code-panel').count(),1);
    const code=await p.locator('.code-lines').innerText();
    await p.locator('[data-action=code-larger]').click();await p.locator('[data-action=code-wrap]').click();
    assert.equal(await p.locator('.code-lines').innerText(),code,'code controls preserve code');
    await shot(p,'focus-main-code-desktop',true);
    await p.locator('.exam-tools [data-action=calc]').click();await p.getByLabel('Выражение калькулятора').fill('(24+8)/4');await p.getByLabel('Выражение калькулятора').press('Enter');
    assert.equal(await p.getByLabel('Выражение калькулятора').inputValue(),'8');
    await p.locator('[data-action=scratch]').click();await p.locator('[data-notes]').fill('Черновик сохраняется после каждого изменения.');
    const before=await saved(p,mainKey);await p.reload();await p.locator('[data-action=unlock]').click();
    const restored=await saved(p,mainKey);assert.deepEqual(restored.taskIds,before.taskIds);assert.deepEqual(restored.answers,before.answers);assert.deepEqual(restored.flags,before.flags);assert.deepEqual(restored.notes,before.notes.map(n=>n||''));
    await p.locator('[data-action=scratch]').click();assert.match(await p.locator('[data-notes]').inputValue(),/Черновик сохраняется/);
    await p.evaluate(()=>document.exitFullscreen());await p.locator('[data-action=unlock]').waitFor();
    await p.locator('[data-notes]').evaluate(el=>{el.value='blocked';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.deepEqual((await saved(p,mainKey)).notes,before.notes.map(n=>n||''),'lock prevents scratch changes');
    await p.locator('[data-action=unlock]').click();
    await mainMap(p,3);await p.locator('.task-image').click();await p.locator('[data-action=zoom-plus]').click();
    assert.equal(await p.locator('[data-zoom-label]').innerText(),'125%');await p.keyboard.press('Escape');
    assert.equal(await p.locator('#app').evaluate(el=>el.inert),false);
    if(await p.locator('[data-action=scratch]').getAttribute('aria-expanded')==='true')await p.locator('[data-action=scratch]').click();
    await mainMap(p,0);
    for(const size of [{width:1280,height:720},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]){
      await p.setViewportSize(size);await noOverflow(p,'main task '+size.width);
    }
    await p.setViewportSize({width:390,height:844});await shot(p,'focus-main-mobile',true);
    await mainMap(p,1);await shot(p,'focus-main-long-mobile',true);await noOverflow(p,'long text on phone');
    await mainMap(p,2);await noOverflow(p,'code on phone');await mainMap(p,4);await noOverflow(p,'matching on phone');
    if(table){await mainMap(p,5);await noOverflow(p,'table on phone');}
    await p.setViewportSize({width:1440,height:1000});
    await p.locator('.exam-top [data-action=confirm-finish]').click();assert.equal(await p.locator('.overview-row').count(),taskIds.length);
    await p.locator('[data-action=finish]').click();await p.locator('.report-hero').waitFor();await shot(p,'focus-results-desktop',true);
    await p.locator('.topbar [data-action=teacher]').click();await shot(p,'focus-teacher-desktop',true);
    await context.close();

    const ogeContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),q=await ogeContext.newPage();
    q.on('pageerror',e=>errors.push(e.message));q.on('dialog',d=>d.accept());
    await q.goto(url+'oge.html');await shot(q,'focus-oge-home-desktop',true);
    await q.locator('[name=source]').selectOption('demo');await q.locator('[name=mode]').selectOption('practice');
    for(const el of await q.locator('[name=task]').all())await el.setChecked([1,6,8,13].includes(Number(await el.getAttribute('value'))));
    await q.locator('[name=student]').fill('Проверка ОГЭ');await q.locator('[name=schoolClass]').fill('9 А');await q.locator('#oge-start [type=submit]').click();
    await q.locator('[data-answer="1"]').fill('физика');
    await q.locator('[data-do=scratch]').click();await q.locator('[data-note="1"]').fill('Ответ и черновик ОГЭ сохранены.');
    await q.locator('[data-do=calc]').click();await q.locator('#calc-input').fill('6*7');await q.locator('#oge-calc button').click();assert.equal(await q.locator('#calc-output').innerText(),'42');
    const ogeBefore=await saved(q,ogeKey);await q.reload();await q.locator('[data-do=unlock]').click();
    assert.deepEqual((await saved(q,ogeKey)).answers,ogeBefore.answers);assert.deepEqual((await saved(q,ogeKey)).notes,ogeBefore.notes);
    await dialogKeyboard(q,'[data-do=task-map]','.oge-modal [data-do=overview]');
    await ogeMap(q,2);await shot(q,'focus-oge-desktop',true);assert.equal(await q.locator('.oge-table').count(),1);
    await ogeMap(q,1);assert.equal(await q.locator('.code-panel').count(),1);await noOverflow(q,'OGE code desktop');
    await q.setViewportSize({width:390,height:844});await shot(q,'focus-oge-code-mobile',true);await noOverflow(q,'OGE code mobile');
    await q.locator('[data-do=scratch]').click();await q.locator('[data-do=calc]').click();await noOverflow(q,'OGE expanded tools mobile');await shot(q,'focus-oge-tools-mobile',true);await q.locator('[data-do=scratch]').click();await q.locator('[data-do=calc]').click();
    await ogeMap(q,2);await shot(q,'focus-oge-mobile',true);await noOverflow(q,'OGE table mobile');
    await q.setViewportSize({width:320,height:740});await noOverflow(q,'OGE 320px');
    await ogeMap(q,3);await noOverflow(q,'OGE file input on phone');assert.equal(await q.locator('.oge-original img').count(),2);
    await q.setViewportSize({width:1440,height:1000});await shot(q,'focus-oge-practice-desktop',true);
    await q.locator('.oge-header [data-do=overview]').click();assert.equal(await q.locator('.oge-check-grid button').count(),4);
    await q.locator('[data-do=overview-question][data-index="0"]').click();assert.equal(await q.locator('[data-answer="1"]').inputValue(),'физика');
    await q.evaluate(()=>document.exitFullscreen());await q.locator('[data-do=unlock]').waitFor();assert.equal(await q.locator('#app').evaluate(el=>el.inert),true);
    await q.locator('[data-answer="1"]').evaluate(el=>{el.value='blocked';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal((await saved(q,ogeKey)).answers[0],'физика');await q.locator('[data-do=unlock]').click();
    await q.locator('.oge-header [data-do=overview]').click();await q.locator('[data-do=finish]').click();await q.locator('.oge-score').waitFor();
    assert.deepEqual(errors,[]);await ogeContext.close();
    console.log('PASS: real tasks, focus map keyboard/focus return, answered/flagged states, original blank-answer guard and explicit skip, code controls, calculator/scratch, exact restored answers/flags/notes, fullscreen locks, image zoom, review/finish, 320–1440px layouts, long text/table/code/file inputs, both sections, zero browser errors. Screenshots: output/focus-*.png');
  } finally {
    if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

