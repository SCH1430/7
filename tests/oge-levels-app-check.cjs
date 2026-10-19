// Real Pages-prefix browser coverage of every OGE number at both new levels.
const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),O=require('../oge-core.js');
const key='1430.oge.v1',numbers=Array.from({length:16},(_,i)=>i+1);
const active=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.active')),key);
const latest=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.results'))[0],key);
async function go(p,index){await p.locator('[data-do=task-map]').click();await p.locator('.task-nav [data-index="'+index+'"]').click();}
async function attach(p,n,answer){
  const input=p.locator('[data-attachment="'+n+'"]');await input.evaluate(el=>el.click());
  await input.setInputFiles({name:answer.name,mimeType:'application/octet-stream',buffer:Buffer.from(answer.buffer)});
  await p.waitForFunction(({key,n,name})=>JSON.parse(localStorage.getItem(key+'.active')).files[n]?.name===name,{key,n,name:answer.name});
}
async function fullCase(browser,url,F,{difficulty,choice13,index}){
  // Every position has one demo, 16 standard author tasks, then four tasks per
  // new level. Compute the target index so a change in ordering fails clearly.
  const selections=numbers.map(n=>O.bank.filter(t=>t.n===n)),ids=numbers.map(n=>`oge-level-${difficulty}-${n}-${index}`);
  const offsets=selections.map((set,i)=>set.findIndex(t=>t.bankId===ids[i]));
  assert.ok(offsets.every(offset=>offset===offsets[0]&&offset>=0),'all target task IDs must occupy the same RNG position');
  assert.ok(selections.every(set=>set.length===selections[0].length));
  const random=(offsets[0]+.5)/selections[0].length,context=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
    await context.addInitScript(value=>{Math.random=()=>value;},random);
    const p=await context.newPage(),errors=[],workers=[],badResponses=[];
    p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept());
    p.on('worker',worker=>workers.push(worker.url()));
    p.on('response',response=>{if(response.status()>=400)badResponses.push(response.status()+' '+response.url());});
    await p.goto(url);await p.locator('#oge-start [name=source]').selectOption('bank');
    await p.locator('#oge-start [name=student]').fill('Уровни '+difficulty+' '+choice13);
    await p.locator('#oge-start [name=schoolClass]').fill('9 А');
    await p.locator('#oge-start [name=choice13]').selectOption(choice13);
    await p.locator('#oge-start [type=submit]').click();await p.locator('[data-do=begin-prepared]').waitFor();
    assert.equal(await active(p),null,'preparation must not start the timer');
    assert.equal(await p.locator('.oge-composition li').count(),16);
    const links=await p.locator('.oge-dialog .oge-downloads a').evaluateAll(links=>links.map(link=>link.href));
    assert.equal(links.length,4,'new archive, file tree, office materials and source sheet must be offered');
    for(const href of links){assert.ok(href.startsWith(new URL(url).origin+'/school1430-trainer/'));const response=await context.request.get(href);assert.equal(response.status(),200,href);assert.ok((await response.body()).length>0,href);}
    await p.locator('[data-do=begin-prepared]').click();await p.locator('.focus-sheet').waitFor();
    const a=await active(p);assert.equal(a.schema,1);assert.equal(a.mode,'full');assert.equal(a.choice13,choice13);assert.deepEqual(a.taskNumbers,numbers);assert.deepEqual(Object.values(a.taskIds),ids);assert.equal(a.deadline-a.startedAt,150*60000);
    for(const n of numbers){
      const task=O.taskFor(a,n);assert.equal(task.bankId,ids[n-1]);assert.equal(task.difficulty,difficulty);assert.equal(task.origin,'authored');
      await go(p,n-1);assert.equal(await p.locator('.question-card h1').innerText(),task.title);
      if(!task.manual)await p.locator('[data-answer="'+n+'"]').fill(task.key);
      else await attach(p,n,await F.buildAnswer(task,{choice13}));
    }
    const filled=await active(p);assert.deepEqual(filled.answers.slice(0,12),numbers.slice(0,12).map(n=>O.taskFor(a,n).key));assert.deepEqual(Object.keys(filled.files),['13','14','15','16']);
    assert.equal(await p.locator('.oge-auto-result').count(),0,'correctness must remain hidden until finishing');
    await p.locator('.focus-header [data-do=overview]').click();await p.locator('[data-do=finish]').click();await p.locator('.oge-score').waitFor();
    const result=O.validate(await latest(p)),score=O.score(result);assert.equal(await active(p),null);assert.equal(score.points,21,JSON.stringify(result.autoChecks));assert.equal(score.total,21);assert.equal(score.pending,0);assert.equal(score.grade,5);assert.deepEqual(result.taskIds,a.taskIds);
    for(const n of [13,14,15,16]){const g=result.autoChecks[n];assert.equal(g.status,'checked',JSON.stringify(g));assert.equal(g.taskId,ids[n-1]);assert.equal(g.max,O.taskFor(result,n).max);assert.equal(g.points,g.max);assert.equal(g.fileHash,result.files[n].sha256);assert.match(g.fileHash,/^[a-f0-9]{64}$/);assert.ok(g.checks.length>0);assert.ok(g.checks.every(check=>check.ok===true),JSON.stringify(g));}
    assert.equal(result.autoChecks[13].engine,'1430-odf');assert.equal(result.autoChecks[14].engine,'1430-odf');assert.equal(result.autoChecks[15].engine,'bounded-kumir-robot');assert.equal(result.autoChecks[16].engine,'bounded-python');
    assert.equal(result.autoChecks[15].checks.length,20);assert.equal(result.autoChecks[16].checks.length,10);
    assert.equal(workers.filter(url=>url.endsWith('/school1430-trainer/oge-grader-worker.js')).length,2,'Robot and Python must execute in real workers');
    assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.match(await p.locator('.oge-score').innerText(),/21 \/ 21/);
    console.log(`PASS: ${difficulty}, choice ${choice13}, variant ${index}: 16 level tasks, four source downloads, real ODF/Worker checks, 21/21 and grade 5.`);
  }finally{await context.close();}
}
(async()=>{
  const {createServer}=await import('./static-site.mjs'),F=await import('./fixtures-oge-levels.mjs'),server=createServer({basePath:'/school1430-trainer/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch(launchOptions);
    const url='http://127.0.0.1:'+server.address().port+'/school1430-trainer/oge.html';
    for(const config of [{difficulty:'start',choice13:'13.1',index:1},{difficulty:'start',choice13:'13.2',index:2},{difficulty:'challenge',choice13:'13.1',index:3},{difficulty:'challenge',choice13:'13.2',index:4}])await fullCase(browser,url,F,config);
    console.log('PASS: four complete new-level OGE variants through real UI on a Pages prefix, both task-13 formats, exact IDs/hashes, zero page errors.');
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
