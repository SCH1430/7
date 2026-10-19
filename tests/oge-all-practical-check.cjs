// Repeatable audit of every practical bank task with real browser graders.
const {chromium,launchOptions}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const O=require('../oge-core.js'),ZIP=require('../oge-zip.js');
const output=path.resolve(__dirname,'../output/oge-audit-autograding.json');
const digest=buffer=>crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

async function wrongAnswer(task,answer,F){
  if(task.n===15)return {name:'wrong.kum',buffer:Buffer.from('использовать Робот\nалг\nнач\nкон'),mutation:'valid Robot program with no paint or movement'};
  if(task.n===16)return {name:'wrong.py',buffer:Buffer.from('print(0)'),mutation:'constant zero instead of a data-dependent count'};
  const entries=await ZIP.read(new Uint8Array(answer.buffer));let changes=0;
  if(task.n===13){
    // Preserve the whole office file and its content; change the requested
    // typography in both inherited and automatic styles.
    for(const name of ['content.xml','styles.xml'])if(entries.has(name)){
      const original=Buffer.from(entries.get(name)).toString('utf8'),changed=original.replace(/fo:font-size="[^"]+"/g,()=>{changes++;return 'fo:font-size="1pt"';});
      entries.set(name,Buffer.from(changed));
    }
  }else{
    const original=Buffer.from(entries.get('content.xml')).toString('utf8'),changed=original.replace(/office:value="(-?\d+(?:\.\d+)?)"/,(_,value)=>{changes++;return `office:value="${Number(value)+1}"`;});
    entries.set('content.xml',Buffer.from(changed));
  }
  assert.ok(changes>0,task.bankId+': the negative fixture must actually change the answer');
  return {name:answer.name,buffer:F.pack(entries),mutation:task.n===13?'all declared font sizes changed to 1 pt':'first numeric source cell changed, answers and chart retained'};
}

function alternatePython(task){
  const g=task.grading;
  if(g?.kind==='level-sequence'&&g.level==='challenge')return `total = 0\nprevious = 0\nvalue = int(input())\nwhile value != 0:\n    if previous > 0:\n        if (previous + value) % ${g.divisor} == 0:\n            if (previous > ${g.threshold} and value <= ${g.threshold}) or (previous <= ${g.threshold} and value > ${g.threshold}):\n                total = total + 1\n    previous = value\n    value = int(input())\nprint(total)`;
  const condition=g?.kind==='level-sequence'?`value % ${g.divisor} == 0`:`value >= ${g?.lower??512} and value < ${g?.upper??4096} and value % ${g?.base??8} == ${g?.remainder??5}`;
  // Read the full stream in one loop and use a separately named counter,
  // rather than copying the stored solution text.
  return `total = 0\nvalue = int(input())\nwhile value != 0:\n    if ${condition}:\n        total = total + 1\n    value = int(input())\nprint(total)`;
}

async function grade(page,task,answer,choice13){
  const base64=Buffer.from(answer.buffer).toString('base64');
  return page.evaluate(async({n,base64,filename,choice13,grading,taskId})=>{
    const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
    return window.OGEGrading1430.grade(n,bytes.buffer,{filename,choice13,grading,taskId});
  },{n:task.n,base64,filename:answer.name,choice13,grading:task.grading,taskId:task.bankId});
}
function checkIdentity(result,task,answer){
  assert.equal(result.taskId,task.bankId);assert.equal(result.max,task.max);assert.equal(result.fileHash,digest(answer.buffer));
}
function details(result){return result?{status:result.status,points:result.points,engine:result.engine,summary:result.summary,hash:result.fileHash,checks:result.checks.length,failedChecks:result.checks.filter(check=>check.ok!==true),errors:result.errors}:null;}

(async()=>{
  const F=await import('./fixtures-oge-practice.mjs'),pack=await import('./fixtures-oge.mjs'),{createServer}=await import('./static-site.mjs');
  const tasks=O.bank.filter(t=>t.n>=13),cases=tasks.flatMap(task=>(task.n===13?['13.1','13.2']:['13.1']).map(choice13=>({task,choice13}))),rows=[];
  assert.equal(O.bank.length,400);assert.equal(tasks.length,100);assert.equal(cases.length,125);for(const n of [13,14,15,16])assert.equal(tasks.filter(t=>t.n===n).length,25);
  await fs.mkdir(path.dirname(output),{recursive:true});
  const server=createServer({basePath:'/school1430-trainer/'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch(launchOptions);const context=await browser.newContext(),page=await context.newPage(),pageErrors=[],httpErrors=[],workers=[];
    page.on('pageerror',error=>pageErrors.push(error.message));page.on('worker',worker=>workers.push(worker.url()));
    context.on('response',response=>{if(response.status()>=400)httpErrors.push({status:response.status(),url:response.url()});});
    const url='http://127.0.0.1:'+server.address().port+'/school1430-trainer/oge.html';await page.goto(url);
    await page.waitForFunction(()=>!!window.OGEGrading1430&&!!window.ODFGrader1430);
    for(const asset of ['oge-grader-worker.js','oge-program-grader.js']){const response=await context.request.get(new URL(asset,url).href);assert.equal(response.status(),200,asset);}
    for(const [caseIndex,{task,choice13}] of cases.entries()){
      const row={id:task.bankId,n:task.n,choice13:task.n===13?choice13:null,difficulty:task.difficulty||'standard',max:task.max,validPoints:null,invalidPoints:null,status:'fail',errors:[]};
      try{
        const answer=await F.buildAnswer(task,{choice13}),negative=await wrongAnswer(task,answer,pack),valid=await grade(page,task,answer,choice13),invalid=await grade(page,task,negative,choice13);
        row.validPoints=valid.points;row.invalidPoints=invalid.points;row.valid=details(valid);row.invalid=details(invalid);row.negativeMutation=negative.mutation;
        try{checkIdentity(valid,task,answer);assert.equal(valid.status,'checked');assert.ok(Number.isInteger(valid.points),'a correct answer must have an integer score');assert.equal(valid.points,task.max);}catch(error){row.errors.push('Valid answer: '+error.message);}
        try{checkIdentity(invalid,task,negative);assert.equal(invalid.status,'checked','a meaningful incorrect fixture must actually be graded');assert.ok(Number.isInteger(invalid.points)&&invalid.points>=0&&invalid.points<task.max,'an incorrect answer must receive an integer score below the maximum');}catch(error){row.errors.push('Invalid answer: '+error.message);}
        if(task.n===16){
          const alternative={name:'alternative.py',buffer:Buffer.from(alternatePython(task))},result=await grade(page,task,alternative,choice13);row.alternative=details(result);
          try{checkIdentity(result,task,alternative);assert.equal(result.status,'checked');assert.ok(Number.isInteger(result.points),'an independent correct answer must have an integer score');assert.equal(result.points,task.max);}catch(error){row.errors.push('Independent Python answer: '+error.message);}
        }
        row.status=row.errors.length?'fail':'pass';
      }catch(error){row.errors.push(error.stack||error.message);}
      rows.push(row);
      if(row.status==='fail')console.error('FAIL '+task.bankId+(task.n===13?' '+choice13:'')+': '+row.errors.join(' | '));
      if((caseIndex+1)%25===0){await fs.writeFile(output,JSON.stringify(rows,null,2)+'\n');console.log(`Audited ${caseIndex+1}/${cases.length} task/format cases; failures: ${rows.filter(row=>row.status==='fail').length}.`);}
    }
    await fs.writeFile(output,JSON.stringify(rows,null,2)+'\n');
    const failures=rows.filter(row=>row.status!=='pass');assert.deepEqual(pageErrors,[],'browser exceptions');assert.deepEqual(httpErrors,[],'HTTP errors, including worker assets');
    assert.equal(workers.length,125,'50 Robot plus 75 Python real-worker evaluations');assert.ok(workers.every(worker=>worker.endsWith('/school1430-trainer/oge-grader-worker.js')));
    assert.equal(failures.length,0,`${failures.length} failed cases; inspect ${output}`);
    console.log(`PASS: ${tasks.length} unique practical tasks, ${cases.length} task/format cases; 125 canonical correct + 125 meaningful incorrect + 25 independent Python answers = 275 real grades. Both task-13 formats, exact task IDs/max/SHA, 125 Workers, zero page/HTTP errors. Report: ${output}`);
    await context.close();
  }finally{await fs.writeFile(output,JSON.stringify(rows,null,2)+'\n');if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
