(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OGEZip=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MiB=1024*1024,MAX_ENTRIES=2000,MAX_ENTRY=32*MiB,MAX_TOTAL=64*MiB,MAX_ARCHIVE=64*MiB;
  const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
  function fail(message){throw Error('Не удалось прочитать ZIP: '+message);}
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function path(bytes){
    let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){fail('имена файлов должны быть в UTF-8.');}
    if(!name||name.length>1024||/[\u0000-\u001f\u007f:]/.test(name)||/^[\\/]/.test(name))fail('недопустимое имя файла.');
    name=name.normalize('NFC').replace(/\\/g,'/');
    const parts=name.split('/');if(parts.some(p=>p==='..'||p==='.'))fail('пути за пределами архива запрещены.');
    name=parts.filter(Boolean).join('/')+(name.endsWith('/')?'/':'');if(!name||name==='/')fail('пустой путь.');return name;
  }
  function equal(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i]);}
  function extra(view,start,length){
    const end=start+length;for(let p=start;p<end;){if(p+4>end)fail('повреждены дополнительные поля.');const tag=view.getUint16(p,true),size=view.getUint16(p+2,true);if(tag===1)fail('ZIP64 не поддерживается.');p+=4+size;if(p>end)fail('повреждены дополнительные поля.');}
  }
  async function inflate(data,size){
    if(typeof DecompressionStream==='function'){
      let decoder;try{decoder=new DecompressionStream('deflate-raw');}catch(_){decoder=null;}
      if(decoder){
        const reader=new Blob([data]).stream().pipeThrough(decoder).getReader(),chunks=[];let count=0;
        try{for(;;){const item=await reader.read();if(item.done)break;count+=item.value.byteLength;if(count>size||count>MAX_ENTRY){await reader.cancel().catch(()=>{});fail('распакованный файл превышает заявленный размер.');}chunks.push(item.value);}}catch(error){if(String(error.message).startsWith('Не удалось прочитать ZIP:'))throw error;fail('ошибка сжатых данных.');}
        if(count!==size)fail('размер распакованного файла не совпадает.');const result=new Uint8Array(size);let p=0;for(const chunk of chunks){result.set(chunk,p);p+=chunk.length;}return result;
      }
    }
    if(typeof module==='object'&&module.exports&&typeof require==='function'){
      try{const result=require('node:zlib').inflateRawSync(data,{maxOutputLength:Math.max(1,size),info:true});if(result.buffer.byteLength!==size||result.engine.bytesWritten!==data.byteLength)fail('размер сжатых данных не совпадает.');return new Uint8Array(result.buffer);}catch(error){if(String(error.message).startsWith('Не удалось прочитать ZIP:'))throw error;fail('ошибка сжатых данных или превышен размер.');}
    }
    fail('браузер не поддерживает распаковку deflate-raw. Откройте тренажёр в актуальном Edge или Chrome.');
  }
  async function read(input){
    if(!(input instanceof ArrayBuffer)&&!(input instanceof Uint8Array))fail('ожидался ArrayBuffer или Uint8Array.');
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<22||bytes.length>MAX_ARCHIVE)fail('недопустимый размер архива.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
    if(end<0)fail('не найдено окончание архива.');
    const disk=view.getUint16(end+4,true),directoryDisk=view.getUint16(end+6,true),diskCount=view.getUint16(end+8,true),count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true),directoryOffset=view.getUint32(end+16,true);
    if(count===65535||directorySize===0xffffffff||directoryOffset===0xffffffff||end>=20&&view.getUint32(end-20,true)===0x07064b50)fail('ZIP64 не поддерживается.');
    if(disk||directoryDisk||diskCount!==count)fail('многотомные архивы не поддерживаются.');
    if(count>MAX_ENTRIES)fail('в архиве более 2000 файлов.');
    const directoryEnd=directoryOffset+directorySize;if(directoryEnd!==end||directoryOffset>end||count*46>directorySize)fail('повреждён каталог архива.');
    const entries=[],names=new Set();let p=directoryOffset,total=0;
    for(let i=0;i<count;i++){
      if(p+46>directoryEnd||view.getUint32(p,true)!==0x02014b50)fail('повреждена запись каталога.');
      const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),packed=view.getUint32(p+20,true),size=view.getUint32(p+24,true),nameLength=view.getUint16(p+28,true),extraLength=view.getUint16(p+30,true),commentLength=view.getUint16(p+32,true),startDisk=view.getUint16(p+34,true),offset=view.getUint32(p+42,true),next=p+46+nameLength+extraLength+commentLength;
      if(next>directoryEnd||!nameLength)fail('повреждена запись файла.');
      if(packed===0xffffffff||size===0xffffffff||offset===0xffffffff)fail('ZIP64 не поддерживается.');
      if(startDisk)fail('многотомные архивы не поддерживаются.');
      if(flags&0x41)fail('зашифрованные файлы не поддерживаются.');
      if(flags&~0x080e)fail('неподдерживаемые флаги ZIP.');
      if(method!==0&&method!==8)fail('поддерживается только сжатие Store и Deflate.');
      if(size>MAX_ENTRY||(total+=size)>MAX_TOTAL)fail('распакованные данные превышают лимит 32 МБ на файл или 64 МБ на архив.');
      if(method===0&&packed!==size)fail('неверный размер несжатого файла.');
      const rawName=bytes.subarray(p+46,p+46+nameLength),name=path(rawName);if(names.has(name))fail('повторяющиеся имена файлов.');names.add(name);
      if(name.endsWith('/')&&size)fail('каталог содержит данные.');
      extra(view,p+46+nameLength,extraLength);
      if(offset+30>directoryOffset||view.getUint32(offset,true)!==0x04034b50)fail('не найден локальный заголовок файла.');
      const localFlags=view.getUint16(offset+6,true),localMethod=view.getUint16(offset+8,true),localCRC=view.getUint32(offset+14,true),localPacked=view.getUint32(offset+18,true),localSize=view.getUint32(offset+22,true),localNameLength=view.getUint16(offset+26,true),localExtraLength=view.getUint16(offset+28,true),dataStart=offset+30+localNameLength+localExtraLength,dataEnd=dataStart+packed;
      if(localFlags!==flags||localMethod!==method||dataStart>directoryOffset||dataEnd>directoryOffset||!equal(rawName,bytes.subarray(offset+30,offset+30+localNameLength)))fail('локальный заголовок не совпадает с каталогом.');
      extra(view,offset+30+localNameLength,localExtraLength);
      let entryEnd=dataEnd;
      if(flags&8){
        if(localCRC&&localCRC!==crc||localPacked&&localPacked!==packed||localSize&&localSize!==size)fail('неверный размер в локальном заголовке.');
        let descriptor=dataEnd;if(descriptor+4<=directoryOffset&&view.getUint32(descriptor,true)===0x08074b50)descriptor+=4;
        if(descriptor+12>directoryOffset||view.getUint32(descriptor,true)!==crc||view.getUint32(descriptor+4,true)!==packed||view.getUint32(descriptor+8,true)!==size)fail('повреждён дескриптор данных.');entryEnd=descriptor+12;
      }else if(localCRC!==crc||localPacked!==packed||localSize!==size)fail('контрольные суммы или размеры заголовков не совпадают.');
      entries.push({name,method,crc,size,offset,dataStart,dataEnd,entryEnd});p=next;
    }
    if(p!==directoryEnd)fail('лишние данные в каталоге.');
    const ordered=[...entries].sort((a,b)=>a.offset-b.offset);for(let i=1;i<ordered.length;i++)if(ordered[i].offset<ordered[i-1].entryEnd)fail('записи файлов пересекаются.');
    const result=new Map();for(const e of entries){const packed=bytes.subarray(e.dataStart,e.dataEnd),decoded=e.method===0?packed.slice():await inflate(packed,e.size);if(decoded.length!==e.size||crc32(decoded)!==e.crc)fail('неверная контрольная сумма файла '+e.name+'.');result.set(e.name,decoded);}return result;
  }
  return {read};
});
