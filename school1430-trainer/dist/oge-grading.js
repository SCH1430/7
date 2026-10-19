(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.OGEGrading1430=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const VERSION='auto-1';
  const str=(v,max=1000)=>String(v??'').slice(0,max);

  async function hash(buffer) {
    if(!root.crypto?.subtle)throw Error('Браузер не поддерживает проверку целостности файлов. Откройте тренажёр через локальный сервер в современном браузере.');
    return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');
  }

  function program(n,buffer,filename,grading) {
    return new Promise((resolve,reject)=>{
      if(typeof Worker==='undefined')return reject(Error('Браузер не поддерживает фоновую проверку программ.'));
      const worker=new Worker('oge-grader-worker.js'),id=crypto.randomUUID();
      const timer=setTimeout(()=>{worker.terminate();reject(Error('Проверка программы превысила лимит времени. Попробуйте упростить программу.'));},10000);
      const end=()=>{clearTimeout(timer);worker.terminate();};
      worker.onerror=()=>{end();reject(Error('Не удалось загрузить модуль проверки программ. Обновите страницу и повторите проверку.'));};
      worker.onmessage=({data})=>{if(data.id!==id)return;end();resolve(data.result);};
      const copy=buffer.slice(0);
      worker.postMessage({id,n,filename,grading,buffer:copy},[copy]);
    });
  }

  function normalize(raw,n,fileHash,taskId) {
    const max=n===14?3:2,status=raw?.supported===false?'unsupported':raw?.incomplete?'partial':'checked';
    const points=['checked','partial'].includes(status)&&Number.isInteger(raw?.points)&&raw.points>=0&&raw.points<=max?raw.points:null;
    return {
      status:points===null&&['checked','partial'].includes(status)?'error':status,points,max,
      ...(status==='partial'?{unverified:Math.max(1,Math.min(max-points,raw.unverifiedIds?.length||1))}:{}),
      engine:str(raw?.engine||'odf-structure',80),version:str(raw?.version||VERSION,50),
      checkedAt:Date.now(),fileHash,...(taskId?{taskId}:{}),
      summary:str(raw?.summary||(points===null?'Файл не удалось оценить автоматически.':'Автоматическая учебная проверка завершена.'),1000),
      checks:(raw?.checks||[]).slice(0,200).map((c,i)=>({id:str(c.id||'criterion-'+i,80),label:str(c.label,200),ok:c.ok===true?true:c.ok===false?false:null,detail:str(c.detail,2000),...(c.input!==undefined?{input:str(c.input,2000)}:{}),...(c.expected!==undefined?{expected:str(c.expected,2000)}:{}),...(c.actual!==undefined?{actual:str(c.actual,2000)}:{})})),
      errors:(raw?.errors||[]).slice(0,100).map(e=>str(e,2000)),
      notes:(raw?.notes||raw?.caveats||[]).slice(0,20).map(e=>str(e,2000))
    };
  }

  function isCurrent(check,n,odfVersion=root.ODFGrader1430?.version){
    if(!check)return false;
    if(n===13||n===14)return check.engine==='1430-odf'&&typeof odfVersion==='string'&&check.version===odfVersion;
    return true;
  }

  async function grade(n,buffer,{filename='',choice13='13.1',grading,taskId}={}) {
    const fileHash=await hash(buffer);
    try {
      let raw;
      if(n===13||n===14){
        if(!root.ODFGrader1430)throw Error('Не удалось загрузить модуль проверки документов.');
        raw=await root.ODFGrader1430.grade(n,buffer,{filename,choice13,grading});
      }else raw=await program(n,buffer,filename,grading);
      return normalize(raw,n,fileHash,taskId);
    } catch(error) {
      // Program mistakes are returned as test results; a thrown worker error is infrastructure.
      const technical=n>=15||/не поддерживает|не удалось загрузить|превысила лимит|недоступен/i.test(error.message);
      return normalize({supported:!technical,points:technical?null:0,engine:'file-validation',version:VERSION,summary:technical?'Автопроверка не завершена.':'Файл не прочитан как работа нужного формата.',checks:[{id:'file-format',label:'Файл открывается для проверки',ok:false,detail:error.message}],errors:[error.message]},n,fileHash,taskId);
    }
  }
  return {VERSION,hash,grade,normalize,isCurrent};
});
