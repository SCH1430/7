const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const C=require('../dist/bank.js');
const root=path.resolve(__dirname,'..');
const total=C.bank.length,pageSize=24,lastPage=Math.ceil(total/pageSize),lastPageSize=total%pageSize||pageSize;
const familyCount=id=>C.bank.filter(b=>b.task.family===`pack-${id}`).length;
const search=async(page,value,selector='#builder-search')=>{await page.locator(selector).fill(value);await page.waitForTimeout(250);};
(async()=>{
  const browser=await chromium.launch(launchOptions);
  try{
    const errors=[];
    const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto('http://127.0.0.1:1430');assert.equal(await page.evaluate(()=>window.TrainerCore.bank.length),total);assert.equal(Number((await page.locator('.hero-facts b').first().innerText()).replace(/\D/g,'')),total);
    await page.screenshot({path:path.join(root,'output/bank1000-home.png')});
    const start=Date.now();await page.locator('.topbar [data-action=builder]').click();assert.equal(await page.locator('.builder-task').count(),pageSize);assert.match(await page.locator('[data-bank-count]').innerText(),new RegExp(`${total} из ${total}`));console.log('Builder initial render:',Date.now()-start,'ms');
    await page.locator('[data-action=builder-select-visible]').click();assert.equal(await page.locator('.selected-tasks li').count(),24);
    await page.locator('[data-bank-page=builder]').first().selectOption('2');assert.equal(await page.locator('.builder-task input:checked').count(),0);await page.locator('.builder-task input').first().check();assert.equal(await page.locator('.selected-tasks li').count(),25);
    await page.locator('[data-bank-page=builder]').first().selectOption('1');assert.equal(await page.locator('.builder-task input:checked').count(),24);await page.locator('[data-action=builder-clear-visible]').click();assert.equal(await page.locator('.selected-tasks li').count(),1);
    await page.locator('[data-bank-page=builder]').first().selectOption(String(lastPage));assert.equal(await page.locator('.builder-task').count(),lastPageSize);await page.locator(`[data-bank-id="${C.bank.at(-1).id}"]`).check();assert.equal(await page.locator('.selected-tasks li').count(),2);
    await page.locator('#builder-origin').selectOption('source');assert.match(await page.locator('[data-bank-count]').innerText(),new RegExp(`${C.bankStats.source} из ${total}`));assert.equal(await page.locator('.builder-task').count(),pageSize);await page.locator('[data-bank-page=builder]').first().selectOption('2');assert.equal(await page.locator('.builder-task').count(),C.bankStats.source-pageSize);
    await page.locator('#builder-origin').selectOption('authored');assert.match(await page.locator('[data-bank-count]').innerText(),new RegExp(`${C.bankStats.authored} из ${total}`));
    await search(page,'Маски имён файлов');assert.match(await page.locator('[data-bank-count]').innerText(),new RegExp(`${familyCount('file-mask')} из ${total}`));await page.locator('[data-bank-page=builder]').first().selectOption(String(Math.ceil(familyCount('file-mask')/pageSize)));assert.equal(await page.locator('.builder-task').count(),familyCount('file-mask')%pageSize||pageSize);
    await search(page,'pack-while-counter-29');assert.equal(await page.locator('.builder-task').count(),1);await page.locator('[data-bank-id=pack-while-counter-29]').check();
    await search(page,'ОБЪЕМ РАСТРА');assert.match(await page.locator('[data-bank-count]').innerText(),new RegExp(`${familyCount('raster-size')} из ${total}`));await search(page,'');
    await page.locator('[data-action=variant-save]').click();await page.reload();await page.locator('.topbar [data-action=builder]').click();assert.equal(await page.locator('.selected-tasks li').count(),3);
    await page.screenshot({path:path.join(root,'output/bank1000-builder.png')});
    for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    await page.screenshot({path:path.join(root,'output/bank1000-builder-mobile.png')});
    await context.close();
    console.log(`PASS: ${total} tasks, ${lastPage} pages, page-scoped bulk actions, selection across pages/reload, source/skill/ID searches and mobile layout.`);

    const ctx=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
    await p.goto('http://127.0.0.1:1430');await p.locator('.topbar [data-action=builder]').click();
    const ids=C.taskPacks.map(pack=>`pack-${pack.id}-${pack.count}`);
    for(const id of ids){await search(p,id);await p.locator(`[data-bank-id="${id}"]`).check();}
    assert.equal(await p.locator('.selected-tasks li').count(),32);await p.locator('#variant-title').fill('Все 32 новые модели');await p.locator('#variant-minutes').fill('120');await p.locator('[name=student]').fill('Тестовый ученик');await p.locator('[name=schoolClass]').fill('7 А');await p.locator('#builder-form button[type=submit]').click();await p.locator('[data-action=start]').click();
    for(const [i,id] of ids.entries()){
      await p.locator("[data-action=exam-map]").click();await p.locator(`.task-nav [data-index="${i}"]`).click();const t=C.bank.find(b=>b.id===id).task;
      for(const [j,f] of t.fields.entries()){
        const controls=p.locator(`[data-field="${j}"]`);
        if(f.type==='text')await controls.fill(f.correct);
        else if(await controls.first().evaluate(el=>el.tagName==='SELECT'))await controls.selectOption(f.correct);
        else if(f.type==='multi')for(const key of f.correct)await p.getByLabel(key,{exact:true}).check();
        else await p.getByLabel(f.correct,{exact:true}).check();
      }
    }
    await p.locator('.exam-top [data-action=confirm-finish]').click();assert.equal(await p.locator('.overview-status.filled').count(),32);await p.locator('[data-action=finish]').click();assert.match(await p.locator('.report-hero').innerText(),/32 из 32/);assert.equal(await p.locator('.review-item').count(),32);
    await p.screenshot({path:path.join(root,'output/bank1000-result.png')});
    const sample=await p.evaluate(()=>JSON.parse(localStorage.getItem('1430.practicum.v1.results'))[0]);
    const sampleModels=['kilobytes','input-devices','device-roles','file-move','loop-sum','fixed-decoding'];
    const indexes=sampleModels.map(model=>ids.findIndex(id=>id.startsWith(`pack-${model}-`)));
    sample.taskIds=indexes.map(i=>sample.taskIds[i]);sample.answers=indexes.map(i=>sample.answers[i]);sample.notes=[];sample.customTitle='Пример новых заданий';
    const bytes=await p.evaluate(async a=>Array.from(await window.PracticumReport.createPdf(a)),sample);await fs.writeFile(path.join(root,'output/1430-bank1000-report.pdf'),Buffer.from(bytes));
    await p.locator('.topbar [data-action=teacher]').click();await p.locator('[data-action=bank-review]').click();assert.equal(await p.locator('.quality-card').count(),pageSize);await p.locator('[data-bank-page=review]').first().selectOption(String(lastPage));assert.equal(await p.locator('.quality-card').count(),lastPageSize);
    await search(p,'pack-bytes-bits-30','#review-search');assert.equal(await p.locator('.quality-card').count(),1);await p.locator('[data-action=review-task]').click();await p.locator('.model-source').waitFor();assert.equal(await p.locator('.source-image').count(),0);assert.match(await p.locator('.model-source').innerText(),/отдельного исходного скриншота нет/);
    await p.locator('#review-form [name=reviewer]').fill('Тестовый учитель');for(const name of ['condition','key','explanation','source'])await p.locator(`#review-form [name=${name}]`).check();await p.locator('#review-form [name=status]').selectOption('verified');await p.locator('#review-form button[type=submit]').click();assert.equal(await p.locator('.quality-card .verified').count(),1);
    await search(p,'','#review-search');await p.locator('#review-filter').selectOption('verified');assert.equal(await p.locator('.quality-card').count(),1);await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:path.join(root,'output/bank1000-teacher-mobile.png')});
    assert.deepEqual(errors,[]);await ctx.close();console.log('PASS: all 32 models completed through public controls; score 32/32; PDF; teacher pagination/search; honest authored provenance; teacher review; zero browser errors.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
