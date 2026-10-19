import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const sha=value=>createHash('sha256').update(value).digest('hex');
export async function auditState(){
  const O=require('../dist/oge-core.js'),names=[
    'dist/oge-core.js','dist/oge-bank.js','dist/oge-levels.js','dist/oge-practice-bank.js','dist/oge-practical-levels.js',
    'dist/oge-app.js','dist/oge-catalog.js','dist/oge-builder.js','dist/oge.html','dist/oge-grading.js',
    'dist/oge-odf-grader.js','dist/oge-program-grader.js','dist/oge-zip.js','dist/oge-grader-worker.js',
    'dist/assets/oge-2027/sources.json','dist/assets/oge-bank/practice/sources.json','dist/assets/oge-bank/levels/sources.json',
    'tests/oge-short-audit.test.cjs','tests/oge-practical-audit.test.cjs','tests/oge-all-practical-check.cjs','tests/oge-practical-audit-check.cjs',
    'tests/oge-cache.test.cjs','tests/oge-cache-check.cjs'
  ];
  const files=[];for(const name of names)files.push({path:name,sha256:sha((await readFile(path.join(root,name),'utf8')).replace(/\r\n/g,'\n'))});
  const assets=new Set(['dist/assets/oge-2027/fipi-demo.pdf']);
  for(const task of O.bank){const prefix='dist/'+(task.asset||O.asset);if(task.download)assets.add(prefix+task.download);for(const image of task.images||[])assets.add(prefix+image);}
  const original=JSON.parse(await readFile(path.join(root,'dist/assets/oge-2027/sources.json'),'utf8'));
  for(const list of Object.values(original.images||{}))for(const image of list)assets.add('dist/assets/oge-2027/'+image);
  for(const name of [...assets].sort()){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,name)))hash.update(chunk);files.push({path:name,sha256:hash.digest('hex')});}
  const state={bankSha256:sha(JSON.stringify(O.bank)),files};return {...state,sha256:sha(JSON.stringify(state))};
}
