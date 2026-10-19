// Legacy ODF cache migration must re-read the saved file and preserve teacher marks.
const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const O=require('../dist/oge-core.js'),ZIP=require('../dist/oge-zip.js'),key='1430.oge.v1';
const latest=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.results'))[0],key);
async function runCase(browser,url,F,pack,teacherOverride){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  try{
    await context.addInitScript(()=>{Math.random=()=>0;});
    const p=await context.newPage(),errors=[],httpErrors=[];p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept());
    context.on('response',response=>{if(response.status()>=400)httpErrors.push(response.status()+' '+response.url());});
    await p.goto(url);await p.locator('#oge-start [name=student]').fill(teacherOverride?'Старый кеш и учитель':'Старый кеш без учителя');await p.locator('#oge-start [name=schoolClass]').fill('9 А');
    await p.locator('#oge-start [name=mode]').selectOption('practice');for(const input of await p.locator('#oge-start [name=task]').all())await input.setChecked(Number(await input.getAttribute('value'))===13);
    await p.locator('#oge-start [type=submit]').click();await p.locator('[data-do=begin-prepared]').click();await p.locator('[data-attachment="13"]').waitFor();
    const active=await p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.active')),key),task=O.taskFor(active,13),answer=await F.buildAnswer(task,{choice13:'13.1'});
    assert.equal(task.bankId,'oge-fipi-13');
    const input=p.locator('[data-attachment="13"]');await input.evaluate(el=>el.click());await input.setInputFiles({name:answer.name,mimeType:'application/octet-stream',buffer:Buffer.from(answer.buffer)});
    await p.waitForFunction(k=>!!JSON.parse(localStorage.getItem(k+'.active')).files[13],key);
    await p.locator('.focus-header [data-do=overview]').click();await p.locator('[data-do=finish]').click();await p.locator('.oge-score').waitFor();
    const original=await latest(p);assert.equal(original.autoChecks[13].points,2);assert.equal(original.autoChecks[13].status,'checked');
    const currentVersion=await p.evaluate(()=>window.ODFGrader1430.version);assert.notEqual(currentVersion,'1.0.0');
    const entries=await ZIP.read(new Uint8Array(answer.buffer)),content=Buffer.from(entries.get('content.xml')).toString('utf8');
    const changed=content.replace(/(<draw:frame draw:name="title1"[^>]*svg:x=")[^"]+/,(_,prefix)=>prefix+'100cm');assert.notEqual(changed,content,'the negative ODP must move its title outside the slide');
    entries.set('content.xml',Buffer.from(changed));const bad=Buffer.from(pack.pack(entries)),hash=crypto.createHash('sha256').update(bad).digest('hex'),base64=bad.toString('base64');
    const expected=await p.evaluate(async({base64,taskId})=>{const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));return window.OGEGrading1430.grade(13,bytes.buffer,{filename:'answer.odp',choice13:'13.1',taskId});},{base64,taskId:task.bankId});
    assert.equal(expected.status,'checked');assert.ok(Number.isInteger(expected.points)&&expected.points>=0&&expected.points<2,'the current grader must reject full credit for an out-of-bounds title');
    const mark={points:2,reviewer:'Учитель, независимая оценка',comment:'Сохранить при обновлении автоматической проверки',at:123456};
    await p.evaluate(async({key,id,base64,hash,teacherOverride,mark})=>{
      const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),db=await new Promise((resolve,reject)=>{const request=indexedDB.open('1430-oge-files',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(bytes.buffer,id+':13');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();
      const results=JSON.parse(localStorage.getItem(key+'.results')),a=results.find(a=>a.id===id);a.files[13]={name:'answer.odp',size:bytes.byteLength,sha256:hash};
      a.autoChecks[13]={...a.autoChecks[13],status:'checked',points:2,max:2,engine:'1430-odf',version:'1.0.0',fileHash:hash,summary:'STALE ODF CACHE: full score from the old grader'};
      if(teacherOverride)a.marks[13]=mark;else delete a.marks[13];localStorage.setItem(key+'.results',JSON.stringify(results));
    },{key,id:original.id,base64,hash,teacherOverride,mark});
    const cached=O.validate(await latest(p));assert.equal(cached.autoChecks[13].version,'1.0.0');assert.equal(O.score(cached).points,2);
    await p.reload();await p.locator('.oge-header [data-do=history]').click();await p.locator('.oge-history [data-do=report]').click();
    await p.waitForFunction(({key,version})=>JSON.parse(localStorage.getItem(key+'.results'))[0].autoChecks[13].version===version,{key,version:currentVersion});await p.locator('.oge-score').waitFor();
    const migrated=O.validate(await latest(p)),score=O.score(migrated),g=migrated.autoChecks[13];
    assert.equal(g.status,'checked');assert.equal(g.engine,'1430-odf');assert.equal(g.version,currentVersion);assert.equal(g.points,expected.points);assert.equal(g.taskId,task.bankId);assert.equal(g.fileHash,hash);assert.equal(migrated.files[13].sha256,hash);assert.doesNotMatch(g.summary,/STALE ODF CACHE/);assert.ok(Number.isInteger(g.points)&&g.points<2);
    if(teacherOverride){assert.deepEqual(migrated.marks[13],mark);assert.equal(score.points,2);assert.equal(score.rows[0].evaluation,'teacher');assert.equal(score.rows[0].automatic.points,expected.points);}
    else{assert.equal(score.points,expected.points);assert.equal(score.rows[0].evaluation,'auto');assert.deepEqual(migrated.marks,{});}
    // A current cache should be reused when the same report is opened again.
    const checkedAt=g.checkedAt;await p.locator('.oge-header [data-do=history]').click();await p.locator('.oge-history [data-do=report]').click();await p.locator('.oge-score').waitFor();assert.equal((await latest(p)).autoChecks[13].checkedAt,checkedAt);
    assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
    console.log(`PASS: cached ODF 1.0.0 2/2 -> ${currentVersion} ${g.points}/2 from the actual IndexedDB file; teacher override ${teacherOverride?'preserved with priority':'absent'}, current cache reused, zero browser/HTTP errors.`);
  }finally{await context.close();}
}
(async()=>{
  const F=await import('./fixtures-oge-practice.mjs'),pack=await import('./fixtures-oge.mjs'),{createServer}=await import('../server.mjs'),server=createServer({basePath:'/school1430-trainer/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{browser=await chromium.launch(launchOptions);const url='http://127.0.0.1:'+server.address().port+'/school1430-trainer/oge.html';for(const teacherOverride of [false,true])await runCase(browser,url,F,pack,teacherOverride);}
  finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
