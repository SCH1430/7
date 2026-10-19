// Rebuild the 16 authored source spreadsheets; student answers are omitted.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sourceODS} from '../tests/fixtures-oge-practice.mjs';
const folder=fileURLToPath(new URL('../assets/oge-bank/practice/',import.meta.url));
mkdirSync(folder,{recursive:true});
const files=[];
for(let i=1;i<=16;i++){
  const file=`table-${i}.ods`,buffer=sourceODS(i);
  writeFileSync(folder+file,buffer);
  files.push({file,origin:'authored',rows:128+8*i,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});
}
writeFileSync(folder+'sources.json',JSON.stringify({description:'Авторские учебные таблицы школы 1430. Не являются материалами ФИПИ.',files},null,2)+'\n');
console.log('Rebuilt 16 authored OGE source spreadsheets');
