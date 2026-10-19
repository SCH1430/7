// Real browser coverage for the authored OGE bank and per-student task rotation.
const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),O=require('../dist/oge-core.js');
const root=path.resolve(__dirname,'..'),url=process.env.TRAINER_URL||'http://127.0.0.1:1430/oge.html',key='1430.oge.v1';
const getActive=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.active')),key);
const getResults=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.results'))||[],key);

async function prepare(p,{name='Семёнов   Тест',schoolClass='9 А',choice13='13.1',numbers=null,source='bank',cancel=false,defer=false}={}){
  await p.goto(url);await p.locator('[name=source]').selectOption(source);
  await p.locator('[name=student]').fill(name);await p.locator('[name=schoolClass]').fill(schoolClass);await p.locator('[name=choice13]').selectOption(choice13);
  if(numbers){await p.locator('[name=mode]').selectOption('practice');for(const el of await p.locator('[name=task]').all())await el.setChecked(numbers.includes(Number(await el.getAttribute('value'))));}
  await p.locator('#oge-start [type=submit]').click();
  if(source==='bank'){
    await p.locator('[data-do=begin-prepared]').waitFor();assert.equal(await getActive(p),null,'preparing files does not start or spend an attempt');
    assert.equal(await p.locator('.oge-auto-result').count(),0,'preparation reveals no correctness');
    if(cancel){await p.locator('[data-do=cancel-prepared]').click();assert.equal(await getActive(p),null);return;}
    if(defer)return;
    await p.locator('[data-do=begin-prepared]').click();
  }
  await p.locator('.question-card').waitFor();return getActive(p);
}

async function attach(p,n,{name,buffer}){
  const el=p.locator(`[data-attachment="${n}"]`);await el.evaluate(x=>x.click());await el.setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(buffer)});
  await p.waitForFunction(({k,n,name})=>JSON.parse(localStorage.getItem(k+'.active')).files[n]?.name===name,{k:key,n,name});
}
async function finish(p){await p.locator('.oge-header [data-do=overview]').click();await p.locator('[data-do=finish]').click();await p.locator('.oge-score').waitFor();return(await getResults(p))[0];}
async function fillAll(p,a,F){
  for(let i=0;i<a.taskNumbers.length;i++){
    const n=a.taskNumbers[i],t=O.taskFor(a,n);await p.locator("[data-do=task-map]").click();await p.locator(`.task-nav [data-index="${i}"]`).click();
    assert.match(await p.locator('.question-card h1').innerText(),new RegExp(t.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(n<=12)await p.locator(`[data-answer="${n}"]`).fill(t.key);
    else await attach(p,n,await F.buildAnswer(t,{choice13:a.choice13}));
  }
}
function checkFull(a){
  assert.equal(a.selectionMode,'oge-rotation-v1');assert.equal(Object.keys(a.taskIds).length,16);
  const s=O.score(a);assert.equal(s.points,21,JSON.stringify(a.autoChecks));assert.equal(s.total,21);assert.equal(s.pending,0);assert.equal(s.grade,5);
  for(const n of [13,14,15,16]){assert.equal(a.autoChecks[n].status,'checked');assert.equal(a.autoChecks[n].taskId,a.taskIds[n]);assert.equal(a.autoChecks[n].fileHash,a.files[n].sha256);}
}

(async()=>{
  const F=await import('./fixtures-oge-practice.mjs'),browser=await chromium.launch(launchOptions);
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
    // A stable random source keeps this integration test reproducible while still exercising rotation.
    await context.addInitScript(()=>Math.random=()=>.31);
    const page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{if(!r.url().startsWith(new URL(url).origin)&&!r.url().startsWith('blob:'))external.push(r.url());});
    await prepare(page,{cancel:true});assert.deepEqual(await getResults(page),[],'cancelled preparation never consumes a task');
    // Another tab may finish a prepared selection while this tab is still gathering its files.
    const staleName='Проверка другой вкладки';await prepare(page,{name:staleName,defer:true});
    const staleSelection=O.nextVariant({name:staleName,schoolClass:'9 А',choice13:'13.1',attempts:[]},()=>.31);
    await page.evaluate(({k,name,selection})=>{const now=Date.now(),a=window.OGE1430.validate({kind:'1430-oge-result',schema:1,id:crypto.randomUUID(),variantId:window.OGE1430.id,mode:'full',taskNumbers:Array.from({length:16},(_,i)=>i+1),name,schoolClass:'9 А',choice13:'13.1',startedAt:now-1000,deadline:now-1000+9000000,finishedAt:now,answers:Array(16).fill(''),notes:Array(16).fill(''),files:{},marks:{},events:[],...selection});localStorage.setItem(k+'.results',JSON.stringify([a]));},{k:key,name:staleName,selection:staleSelection});
    await page.locator('[data-do=begin-prepared]').click();await page.waitForFunction(()=>!document.querySelector('[data-do=begin-prepared]'));assert.equal(await getActive(page),null,'a stale prepared selection must not create an active attempt');assert.match(await page.locator('#toast').innerText(),/заново|другой|измен|обнов|повтор/i);
    let a=await prepare(page,{name:staleName});for(const n of a.taskNumbers)assert.notEqual(a.taskIds[n],staleSelection.taskIds[n],'re-preparation reads the finished selection from the other tab');await finish(page);
    a=await prepare(page);await fillAll(page,a,F);assert.equal(await page.locator('.oge-auto-result').count(),0);const first=await finish(page);checkFull(first);
    await page.screenshot({path:path.join(root,'output/1430-oge-random-result.png'),fullPage:true});
    const pdfDownload=page.waitForEvent('download');await page.locator('[data-do=pdf]').click();await(await pdfDownload).saveAs(path.join(root,'output/1430-oge-random-report.pdf'));
    a=await prepare(page,{name:' семенов тест ',schoolClass:'9а'});
    for(const n of a.taskNumbers)assert.notEqual(a.taskIds[n],first.taskIds[n],`same pupil must get a new task №${n}`);
    const secondIds={...a.taskIds};await fillAll(page,a,F);
    await page.reload();await page.locator('[data-do=unlock]').click();await page.locator('.question-card').waitFor();assert.deepEqual((await getActive(page)).taskIds,secondIds,'reload retains the exact selected tasks');
    const second=await finish(page);checkFull(second);
    // Package metadata never supplies trusted grading criteria or automatic scores.
    const d=page.waitForEvent('download');await page.locator('[data-do=export]').click();const download=await d;
    const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const pkg=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const before=O.studentProgress({name:second.name,schoolClass:second.schoolClass,choice13:second.choice13,attempts:await getResults(page)});
    for(const n of [13,14,15,16]){pkg.attempt.autoChecks[n].points=0;pkg.attempt.autoChecks[n].taskId='fake-grade-task';pkg.attempt.autoChecks[n].summary='<img src=x onerror=alert(1)>';}
    pkg.attempt.grading={answer1:0,answer2:0};
    await page.locator('.oge-header [data-do=teacher]').click();await page.locator('#oge-import').setInputFiles({name:'tampered-result.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});await page.locator('.oge-score').waitFor();
    const imported=(await getResults(page))[0];checkFull(imported);assert.deepEqual(imported.taskIds,second.taskIds);assert.doesNotMatch(imported.autoChecks[16].summary,/onerror/);
    const after=O.studentProgress({name:second.name,schoolClass:second.schoolClass,choice13:second.choice13,attempts:await getResults(page)});assert.deepEqual(after,before,'importing the same task IDs does not consume the bank twice');
    // A different registered task uses that task's own tests, never the old task's cached result.
    const changed=structuredClone(pkg),oldConfig=O.taskFor(second,16).grading,newProgram=O.bank.find(t=>t.n===16&&t.grading&&t.grading.base!==oldConfig.base);
    changed.attempt.taskIds[16]=newProgram.bankId;
    await page.locator('.oge-header [data-do=teacher]').click();await page.locator('#oge-import').setInputFiles({name:'changed-program-task.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});await page.locator('.oge-score').waitFor();const changedResult=(await getResults(page))[0];assert.equal(changedResult.autoChecks[16].taskId,newProgram.bankId);assert.ok(changedResult.autoChecks[16].points<2,'a solution for a different base must be checked against the newly selected task');
    // Unknown IDs are rejected before storing any imported result.
    const count=(await getResults(page)).length;pkg.attempt.taskIds[14]='unregistered-task';await page.locator('.oge-header [data-do=teacher]').click();await page.locator('#oge-import').setInputFiles({name:'bad-id.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});await page.waitForFunction(()=>document.querySelector('#toast').classList.contains('show'));assert.equal((await getResults(page)).length,count);
    // Presentation and document choices have independent histories for position 13.
    a=await prepare(page,{name:'СЕМЕНОВ ТЕСТ',schoolClass:'9А',choice13:'13.2',numbers:[13]});assert.equal(a.taskIds[13],first.taskIds[13]);await fillAll(page,a,F);const documentResult=await finish(page);assert.equal(O.score(documentResult).points,2);assert.equal(O.score(documentResult).pending,0);
    // A fresh pupil has independent history and may receive exactly the first pupil's initial selection.
    a=await prepare(page,{name:'Другой ученик',schoolClass:'9 А'});assert.deepEqual(a.taskIds,first.taskIds);await finish(page);
    // Explicit FIPI demo remains fixed and readable, independently of bank rotation.
    a=await prepare(page,{source:'demo',name:'Демоверсия',numbers:[1,5,6,16]});
    assert.equal(O.taskFor(a,1).key,'физика');await fillAll(page,a,F);const fixed=await finish(page);assert.equal(O.score(fixed).points,5);assert.equal(O.score(fixed).pending,0);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(root,'output/1430-oge-random-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
    console.log('PASS: preparation cancellation and stale-tab rejection; two random full variants with 21/21 and task-bound practical checks; PDF; normalized pupil history; exact IDs and files after reload; recomputed JSON import; changing a registered task uses its own tests; duplicate imports do not consume history; unknown IDs rejected; independent pupil; fixed demo; mobile; offline; zero browser errors.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
