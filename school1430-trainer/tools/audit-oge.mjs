// Repeat the audit from current sources before writing a shareable snapshot.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {auditState} from './oge-audit-state.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),O=require('../dist/oge-core.js');
const reportPath=path.join(root,'quality/oge-audit.json');
async function run(args){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(args.join(' ')+' failed: '+code)));
  });
}
function requirePassed(condition,message){if(!condition)throw Error(message);}
await mkdir(path.dirname(reportPath),{recursive:true});
try{
  const before=await auditState();
  await run(['--test','tests/oge-short-audit.test.cjs','tests/oge-practical-audit.test.cjs']);
  await run(['tests/oge-all-practical-check.cjs']);
  await run(['tests/oge-practical-audit-check.cjs']);
  await run(['tests/oge-cache-check.cjs']);
  await run(['tools/check-pages.mjs']);
  const read=async name=>JSON.parse(await readFile(path.join(root,'output',name),'utf8'));
  const short=await read('oge-audit-short.json'),practical=await read('oge-audit-practical.json'),grading=await read('oge-audit-autograding.json');
  requirePassed(Array.isArray(short)&&short.length===250,'Missing part of the 250-task short-answer audit.');
  requirePassed(Array.isArray(practical)&&practical.length===150,'Missing part of the 150-task practical-condition audit.');
  const records=[...short,...practical],byId=new Map(records.map(record=>[record.id,record]));
  requirePassed(O.bank.length===400&&byId.size===400&&records.length===400,'The audit must cover each bank ID exactly once.');
  requirePassed(Array.isArray(grading)&&grading.length===125,'Both task-13 formats and every other practical task must be graded.');
  const state=await auditState();requirePassed(state.sha256===before.sha256,'Sources changed during the audit; run it again.');
  const tasks=O.bank.map(task=>{
    const record=byId.get(task.bankId);requirePassed(record&&record.n===task.n&&record.status==='pass','Condition audit failed for '+task.bankId);
    requirePassed(!record.issues?.length&&Array.isArray(record.checks)&&record.checks.length&&record.checks.every(c=>c.passed===true),'An unresolved condition check remains: '+task.bankId);
    const cases=grading.filter(g=>g.id===task.bankId);
    if(task.manual){
      const expected=task.n===13?['13.1','13.2']:['13.1'];requirePassed(cases.length===expected.length,'Missing practical format: '+task.bankId);
      if(task.n===13)requirePassed(expected.every(choice=>cases.some(g=>g.choice13===choice)),'Missing task-13 alternative: '+task.bankId);
      for(const g of cases)requirePassed(g.n===task.n&&g.max===task.max&&g.status==='pass'&&!g.errors?.length&&g.valid?.status==='checked'&&Number.isInteger(g.validPoints)&&g.validPoints===task.max&&g.invalid?.status==='checked'&&Number.isInteger(g.invalidPoints)&&g.invalidPoints>=0&&g.invalidPoints<task.max,'Grading failed for '+task.bankId);
    }else requirePassed(cases.length===0,'Unexpected file grading for '+task.bankId);
    return {...record,grading:cases};
  });
  const levels=Object.fromEntries(['start','standard','challenge'].map(level=>[level,O.bank.filter(t=>t.difficulty===level).length]));
  const report={schema:1,generatedAt:new Date().toISOString(),version:require('../package.json').version,passed:true,taskCount:400,levels,numberCount:16,perNumber:25,shortAnswerTasks:300,practicalTasks:100,practicalFormats:125,state,
    methodology:'Each displayed short-answer condition is parsed and independently recomputed. File searches use actual archives. Spreadsheet source rows and computed answers are checked. All practical IDs are graded in a real browser with valid and invalid files; task 13 uses both formats. Separate regressions cover typography, transitions, geometry and spreadsheet formula caches.',
    limits:['Educational difficulty labels are not official calibrated levels.','Finite program test suites do not prove correctness for every possible input.','Automated document checks cover machine-readable features; semantic and visual quality can still need teacher review.','FIPI source provenance is recorded in dist/assets/oge-2027/sources.json; the supplied official mirror has not been byte-compared with the unavailable original download.'],tasks};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log('AUDIT PASS: 400/400 conditions, 300 short-answer tasks, 100 practical tasks / 125 formats. Snapshot: quality/oge-audit.json');
}catch(error){
  await writeFile(reportPath,JSON.stringify({schema:1,generatedAt:new Date().toISOString(),passed:false,taskCount:O.bank.length,error:error.message},null,2)+'\n');
  throw error;
}
