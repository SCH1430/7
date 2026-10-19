import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {pack,sourceODS,illustration} from '../tests/fixtures-oge-levels.mjs';
const require=createRequire(import.meta.url),B=require('../dist/oge-practical-levels.js'),folder=fileURLToPath(new URL('../dist/assets/oge-bank/levels/',import.meta.url)),files=[];
mkdirSync(folder,{recursive:true});
function save(file,buffer){writeFileSync(folder+file,buffer);files.push({file,origin:'authored',bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});}
for(const level of ['start','challenge'])for(let i=1;i<=4;i++){
  for(const n of [11,12])save(`task${n}-${level}-${i}.zip`,pack(B.filesFor(level,i,n)));
  const g=B.officeSpec(level,i),texts=['Тема: '+g.title,'13.1: тексты слайдов',...g.slides.map(s=>s.title+'\n'+s.paragraphs.join('\n')),'13.2: абзацы',...g.paras,'Список',...g.list,'Таблица',...g.table.map(r=>r.join(' | '))].join('\n\n');
  save(`task13-${level}-${i}.zip`,pack({'Тексты.txt':texts,'Иллюстрация.svg':illustration(i),'Прочитай.txt':'Это авторский учебный комплект школы 1430. Требования к оформлению берите из условия именно этой версии.'}));
  save(`table-${level}-${i}.ods`,sourceODS(level,i));
}
writeFileSync(folder+'sources.json',JSON.stringify({description:'Авторские материалы учебных уровней №11–14. Не являются файлами демоверсии ФИПИ.',files},null,2)+'\n');
console.log('Rebuilt '+files.length+' level archives and source spreadsheets.');
