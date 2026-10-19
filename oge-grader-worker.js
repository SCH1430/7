'use strict';
importScripts('oge-program-grader.js');
self.onmessage = ({data}) => {
  const {id,n,buffer,filename,grading}=data;
  try {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength>200000) throw Error('Для автопроверки нужен исходный код не более 200 КБ.');
    let source;
    try { source=new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
    catch { source=new TextDecoder('windows-1251').decode(buffer); }
    if(source.includes('\0'))throw Error('Нужен текст исходной программы, а не двоичный файл.');
    const result=n===15?self.ProgramGrader1430.grade15(source,{filename,grading}):self.ProgramGrader1430.grade16(source,{filename,grading});
    self.postMessage({id,result});
  } catch(error) {
    self.postMessage({id,result:{supported:false,points:null,max:2,engine:'bounded-interpreter',version:'1',summary:'Не удалось проверить исходный код.',errors:[error.message],checks:[]}});
  }
};
