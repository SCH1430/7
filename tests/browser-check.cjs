const {chromium,launchOptions}=require('./browser-runtime.cjs');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const C=require('../bank.js');
const base='http://127.0.0.1:1430',root=path.resolve(__dirname,'..');
async function fillTask(page,t){for(const [j,f] of t.fields.entries()){const controls=page.locator(`[data-field="${j}"]`);if(f.type==='text')await controls.fill(f.correct);else if(await controls.first().evaluate(el=>el.tagName==='SELECT'))await controls.selectOption(f.correct);else if(f.type==='multi'){for(const option of f.options){const control=page.getByLabel(option,{exact:true});if(f.correct.includes(option))await control.check();else await control.uncheck();}}else await page.getByLabel(f.correct,{exact:true}).check();}}
(async()=>{
 const browser=await chromium.launch(launchOptions);
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',async d=>{if(d.type()==='beforeunload')await d.accept();else await d.dismiss();});
 await page.goto(base);await page.screenshot({path:path.join(__dirname,'home-desktop.png'),fullPage:true});
 assert.equal(await page.locator('.level-card').count(),2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('[name=student]').fill('Тестовый ученик');await page.locator('[name=schoolClass]').fill('7 А');
 await page.locator('button[type=submit]').click();await page.locator('[data-action=start]').click();
 await page.locator('.question-card').waitFor();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
 const baseAttempt=await page.evaluate(()=>JSON.parse(localStorage.getItem('1430.practicum.v1.active'))),baseTasks=C.getLevel(baseAttempt).tasks;await fillTask(page,baseTasks[0]);
 assert.equal(await page.locator('.focus-segments button.answered').count(),1);
 await page.screenshot({path:path.join(__dirname,'exam-desktop.png'),fullPage:true});
 await page.locator('[data-action=calc]').click();await page.getByLabel('Выражение калькулятора').fill('4*1024/32');await page.getByLabel('Выражение калькулятора').press('Enter');assert.equal(await page.getByLabel('Выражение калькулятора').inputValue(),'128');
 await page.locator('.calc [data-action=calc]').click();
 await page.evaluate(()=>document.exitFullscreen());await page.getByRole('heading',{name:'Вернёмся к практике.'}).waitFor();assert.equal(await page.locator('#app').evaluate(x=>x.inert),true);
 const before=await page.evaluate(()=>localStorage.getItem('1430.practicum.v1.active'));
 await page.locator('[data-field="0"]').first().evaluate(el=>{if(el.tagName==='SELECT')el.value='';else if(el.type==='text')el.value='';else el.checked=false;el.dispatchEvent(new Event(el.type==='text'?'input':'change',{bubbles:true}));});
 const after=JSON.parse(await page.evaluate(()=>localStorage.getItem('1430.practicum.v1.active')));assert.deepEqual(after.answers,JSON.parse(before).answers);
 await page.screenshot({path:path.join(__dirname,'locked.png'),fullPage:true});
 await page.locator('[data-action=unlock]').click();assert.equal(await page.locator('#app').evaluate(x=>x.inert),false);
 // Headless Edge does not implement OS foreground changes. Exercise the focus event path explicitly.
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.getByRole('heading',{name:'Вернёмся к практике.'}).waitFor();await page.locator('[data-action=unlock]').click();
 // Reload must retain the answer and demand full screen again.
 await page.reload();await page.locator('[data-action=unlock]').waitFor();await page.locator('[data-action=unlock]').click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('1430.practicum.v1.active')).answers[0]),JSON.parse(before).answers[0]);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('1430.practicum.v1.active')).taskIds),baseAttempt.taskIds);
 // Complete the actual sampled base tasks using public controls.
 for(const [i,t] of baseTasks.entries()){await page.locator(`.focus-segments [data-index="${i}"]`).click();await fillTask(page,t);}
 await page.locator('.exam-top [data-action=confirm-finish]').click();await page.locator('[data-action=finish]').click();await page.getByRole('heading',{name:'Есть чем гордиться.'}).waitFor();assert.match(await page.locator('.report-hero').innerText(),/15 из 15/);assert.equal(await page.locator('.review-item').count(),15);
 await page.locator('[data-filter=errors]').click();assert.equal(await page.locator('.review-item').count(),0);await page.locator('[data-filter=all]').click();
 await page.screenshot({path:path.join(__dirname,'result-desktop.png'),fullPage:false});
 const exported=page.waitForEvent('download');await page.locator('[data-action=export]').click();const dl=await exported;await dl.saveAs(path.join(__dirname,'result.json'));
 await page.locator('[data-action=teacher]').first().click();await page.locator('#import-file').setInputFiles(path.join(__dirname,'result.json'));assert.equal(await page.locator('.attempt-item').count(),1);
 console.log('PASS: full-screen start; guard blocks synthetic input after exit; return; focus event; reload; 15/15 UI completion; error filter; JSON roundtrip.');
 // Complete the advanced variant through the same public controls.
 await page.locator('.topbar [data-action=home]').first().click();await page.locator('[data-level=advanced]').click();await page.locator('[name=student]').fill('Тестовый ученик');await page.locator('[name=schoolClass]').fill('7 А');await page.locator('button[type=submit]').click();await page.locator('[data-action=start]').click();await page.locator('.question-card').waitFor();
 const advancedAttempt=await page.evaluate(()=>JSON.parse(localStorage.getItem('1430.practicum.v1.active'))),advancedTasks=C.getLevel(advancedAttempt).tasks;
 for(const [i,t] of advancedTasks.entries()){await page.locator(`.focus-segments [data-index="${i}"]`).click();await fillTask(page,t);}
 await page.locator('.exam-top [data-action=confirm-finish]').click();await page.locator('[data-action=finish]').click();assert.match(await page.locator('.report-hero').innerText(),/13 из 13/);
 console.log('PASS: random advanced variant 13/13 through UI.');
 await context.close();
 // Representative imperfect result and PDF contain actual question illustrations and Cyrillic.
 const sample={schema:1,id:'sample-1430-0001',name:'Тестовый ученик',schoolClass:'7 А',level:'base',startedAt:Date.now()-1200000,finishedAt:Date.now(),reason:'Демонстрационный отчёт',answers:C.levels.base.tasks.map(t=>t.fields.map(f=>structuredClone(f.correct))),events:[{at:Date.now()-1200000,type:'Начало попытки'},{at:Date.now()-600000,type:'Выход из полного экрана'},{at:Date.now()-590000,type:'Возвращение к работе'},{at:Date.now(),type:'Завершение учеником'}]};sample.answers[6]=['64'];sample.answers[10]=['Синий'];sample.answers[12]=[];
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(sample=>localStorage.setItem('1430.practicum.v1.results',JSON.stringify([sample])),sample);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('[data-action=results]').first().click();await p.locator('[data-action=report]').click();await p.screenshot({path:path.join(__dirname,'errors-desktop.png'),fullPage:false});
 const bytes=await p.evaluate(async a=>Array.from(await window.PracticumReport.createPdf(a)),sample);await fs.mkdir(path.join(root,'output'),{recursive:true});await fs.writeFile(path.join(root,'output','1430-example-report.pdf'),Buffer.from(bytes));
 const adv={...sample,id:'sample-advanced',level:'advanced',answers:C.levels.advanced.tasks.map(t=>t.fields.map(f=>structuredClone(f.correct)))};const advancedBytes=await p.evaluate(async a=>Array.from(await window.PracticumReport.createPdf(a)),adv);await fs.writeFile(path.join(__dirname,'advanced-report.pdf'),Buffer.from(advancedBytes));
 await p.setViewportSize({width:390,height:844});await p.locator('.topbar [data-action=home]').first().click();await p.screenshot({path:path.join(__dirname,'home-mobile.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('.topbar [data-action=results]').click();await p.locator('[data-action=report]').click();await p.screenshot({path:path.join(__dirname,'result-mobile.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Expired saved attempt automatically finishes, without a full-screen bypass.
 await p.evaluate(()=>{localStorage.setItem('1430.practicum.v1.active',JSON.stringify({schema:1,id:'timeout-test',name:'Таймер',schoolClass:'7 Б',level:'base',startedAt:Date.now()-46*60000,answers:[],events:[],current:0}));});await p.reload();await p.getByRole('heading',{name:'Теперь знаешь, куда расти.'}).waitFor();assert.match(await p.locator('.report-meta').innerText(),/Время истекло/);
 assert.deepEqual(errors,[]);await ctx.close();await browser.close();console.log('PASS: Cyrillic PDF with illustrations; mobile layout; expired attempt; no browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});
