// Rebuild the small, original text/file archives for authored OGE tasks 11–12.
// Content is created for this project. No external copyrighted texts are used.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),B=require('../oge-bank.js');
const output=fileURLToPath(new URL('../assets/oge-bank/',import.meta.url));mkdirSync(output,{recursive:true});
function crc32(data){let c=0xffffffff;for(const v of data){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(entries){let offset=0;const locals=[],central=[];for(const [name,value] of entries){const filename=Buffer.from(name),data=Buffer.isBuffer(value)?value:Buffer.from(value),crc=crc32(data),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(filename.length,26);locals.push(head,filename,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=head.length+filename.length+data.length;}const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);}
const pdf=Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM6sAAAAASUVORK5CYII=','base64');
// A complete 1x1 JPEG, used only as a file-counting fixture.
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==','base64');
const fileFor=ext=>ext==='.pdf'?pdf:ext==='.png'?png:jpeg;
for(let i=1;i<=16;i++){
  const t=B.short(11,i,{}),surname=t.body.match(/фамилии <strong>([^<]+)/)[1],prefix=`Экспедиция-${i}`;
  writeFileSync(output+`task11-${i}.zip`,zip([
    [`${prefix}/Инструкция.txt`,'Это авторский учебный архив «1430 / практикум». Все персонажи и документы вымышлены.'],
    [`${prefix}/Сотрудники/карточка.txt`,`Анкета сотрудника.\n${surname} — ${t.key}.\nУчаствует в экспедиции номер ${i}.\n`],
    [`${prefix}/Дневники/маршрут.txt`,`День ${i}. Группа нанесла маршрут на карту и проверила оборудование.\n`],
    [`${prefix}/Справки/список.txt`,'На станции работают водитель, врач и повар. Сотрудников из карточек ищите в разделе «Сотрудники».\n']
  ]));
  const count=3+i,extensions=(i-1)%2?['.pdf','.png']:['.jpeg','.pdf'],entries=[];
  for(let k=0;k<count;k++){const folder=k%2?'Восток':'Север',nested=k%3===0?'Вложенные/':'',ext=extensions[k%2];entries.push([`Архив-${i}/${folder}/${nested}объект-${k+1}${ext}`,fileFor(ext)]);}
  entries.push([`Архив-${i}/Север/заметка.pdf.txt`,'Название с дополнительной точкой; это текстовый файл.'],[`Архив-${i}/Восток/фото.jpg`,jpeg],[`Архив-${i}/Север/каталог.pdf/пояснение.txt`,'Каталог с точкой в имени не является файлом PDF.'],[`Архив-${i}/Запад/не-учитывать.pdf`,pdf],[`Архив-${i}/Инструкция.txt`,'Учебный архив «1430 / практикум». Учитывайте только нужные расширения и каталоги.']);
  writeFileSync(output+`task12-${i}.zip`,zip(entries));
}
console.log('Built 32 original OGE task archives.');
