const PREFIX='code1430:';
const DB_NAME='code1430-v1';
const WRITER=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
let dbPromise;
let failureHandler=()=>{},conflictHandler=()=>{};
const pending=new Map();
let legacyRaw,legacyById=new Map();
export function onStorageError(fn){failureHandler=fn;}
export function onAttemptConflict(fn){conflictHandler=fn;}
function warn(){failureHandler('Не удалось сохранить данные в браузере. Скачайте готовую работу перед закрытием страницы.');}
function localGet(key,fallback=null){try{const raw=localStorage.getItem(PREFIX+key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function localSet(key,value){try{localStorage.setItem(PREFIX+key,JSON.stringify(value));return true;}catch{warn();return false;}}
function localRemove(key){try{localStorage.removeItem(PREFIX+key);}catch{}}
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(resolve=>{
    if(!globalThis.indexedDB){resolve(null);return;}
    let settled=false;
    const timeout=setTimeout(()=>{settled=true;resolve(null);},2500);
    try{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('attempts'))req.result.createObjectStore('attempts',{keyPath:'id'});};
      req.onsuccess=()=>{clearTimeout(timeout);if(settled)req.result.close();else{settled=true;resolve(req.result);}};
      req.onerror=req.onblocked=()=>{clearTimeout(timeout);if(!settled){settled=true;resolve(null);}};
    }catch{clearTimeout(timeout);resolve(null);}
  });
  return dbPromise;
}
async function tx(mode,action){
  const db=await openDb();if(!db)return null;
  return new Promise((resolve,reject)=>{try{const transaction=db.transaction('attempts',mode);const req=action(transaction.objectStore('attempts'));let result;req.onsuccess=()=>{result=req.result;};transaction.oncomplete=()=>resolve(result??true);transaction.onerror=transaction.onabort=()=>reject(transaction.error||new Error('Storage error'));}catch(e){reject(e);}});
}
const revision=a=>a?.storageVersion?.revision||0;
const version=a=>a?.storageVersion?.token||`legacy:${a?.updatedAt||a?.startedAt||0}:${a?.phase}`;
const sameWriter=(a,b)=>Boolean(a?.storageVersion&&b?.storageVersion&&a.storageVersion.writer===b.storageVersion.writer&&a.storageVersion.baseToken===b.storageVersion.baseToken);
const phaseRank=a=>({active:0,grading:1,finished:2}[a?.phase]??0);
function submittedAnswers(a){return JSON.stringify([a.finishedAt,a.questions,a.questions?.map(q=>[q.id,q.kind==='program'?a.responses?.[q.id]?.code:a.responses?.[q.id]?.text])]);}
function validTransition(current,next){
  if(current.phase==='finished')return submittedAnswers(current)===submittedAnswers(next)&&Boolean((current.result?.pending>0&&next.phase!=='active')||(next.phase==='finished'&&JSON.stringify(current.result)===JSON.stringify(next.result)));
  return current.phase!=='grading'||next.phase!=='active';
}
function canAdvance(current,next){
  if(!current)return true;
  if(!validTransition(current,next))return false;
  if(version(current)===version(next))return true;
  if(!next.storageVersion)return !current.storageVersion&&(next.updatedAt||next.startedAt||0)>(current.updatedAt||current.startedAt||0);
  return revision(next)>revision(current)&&(sameWriter(current,next)||next.storageVersion.baseToken===version(current));
}
function canAdvanceThroughRecovery(current,next,recovery,seen=new Set()){
  if(canAdvance(current,next))return true;
  if(!validTransition(current,next)||revision(next)<=revision(current)||seen.has(version(next)))return false;
  seen.add(version(next));
  const ancestor=recovery.find(a=>a.id===next.id&&version(a)===next.storageVersion?.baseToken);
  return Boolean(ancestor&&revision(next)>revision(ancestor)&&canAdvanceThroughRecovery(current,ancestor,recovery,seen));
}
function choose(current,next){
  if(!current)return next;
  if(canAdvance(current,next))return next;
  if(canAdvance(next,current))return current;
  // Independent fallback records retain simultaneous writers. Resolve their
  // competing branches consistently, with submitted results taking priority.
  const difference=phaseRank(next)-phaseRank(current)||revision(next)-revision(current)||(next.updatedAt||next.startedAt||0)-(current.updatedAt||current.startedAt||0);
  return difference>0||(difference===0&&version(next)>version(current))?next:current;
}
function legacyRecords(id){
  try{
    const raw=localStorage.getItem(PREFIX+'attempts');
    if(raw!==legacyRaw){
      const byId=new Map();
      for(const a of Object.values(raw?JSON.parse(raw):{}))if(a?.id){const records=byId.get(a.id)||[];records.push(a);byId.set(a.id,records);}
      legacyRaw=raw;legacyById=byId;
    }
    // Only internal targeted checks use this cache, so its records cannot be
    // mutated through listAttempts(). Compare raw values to see other tabs'
    // changes immediately, before an asynchronous storage event is delivered.
    return [...(legacyById.get(id)||[])];
  }catch{return [];}
}
function localRecords(id){
  const targeted=id!==undefined,committed=targeted?legacyRecords(id):Object.values(localGet('attempts',{})),recovery=[];
  const legacy=localGet('recovery');if(legacy?.id&&(!targeted||legacy.id===id))recovery.push(legacy);
  const suffix=targeted?`${encodeURIComponent(id)}:`:'',savedPrefix=PREFIX+'saved:'+suffix,recoveryPrefix=PREFIX+'recovery:'+suffix;
  // Inspect key names on every synchronous check: a new writer may have saved
  // since the previous input. Unrelated history payloads need no reads/parsing.
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(savedPrefix)){const a=localGet(key.slice(PREFIX.length));if(a?.id&&(!targeted||a.id===id))committed.push(a);}else if(key?.startsWith(recoveryPrefix)){const a=localGet(key.slice(PREFIX.length));if(a?.id&&(!targeted||a.id===id))recovery.push(a);}}}catch{}
  return {committed,recovery};
}
function mergeAttempts(committed,recovery=[]){
  const map=new Map();
  for(const a of committed)if(a?.id)map.set(a.id,choose(map.get(a.id),a));
  const durable=new Map(map);
  // A checkpoint must extend its saved ancestor. A newer wall-clock timestamp
  // alone does not permit recovery of a stale branch over a submitted result.
  for(const a of recovery)if(a?.id&&canAdvanceThroughRecovery(durable.get(a.id),a,recovery))map.set(a.id,choose(map.get(a.id),a));
  return map;
}
function localCurrent(id){const {committed,recovery}=localRecords(id);return mergeAttempts(committed,recovery).get(id);}
function recordKey(kind,a){return `${kind}:${encodeURIComponent(a.id)}:${a.storageVersion.writer}`;}
function conflict(attempt,current){
  if(current&&!(current.storageVersion?.writer===WRITER&&sameWriter(current,attempt)))conflictHandler({attempt:structuredClone(attempt),current:structuredClone(current)});
  return false;
}
export function loadPreferences(){return localGet('preferences',{});}
export function savePreferences(value){localSet('preferences',value);}
export function checkpoint(attempt){
  if(!attempt?.id)return false;
  const current=localCurrent(attempt.id);
  if(current&&!canAdvance(current,attempt))return conflict(attempt,current);
  const previous=attempt.storageVersion;
  attempt.storageVersion={writer:WRITER,revision:revision(attempt)+1,token:globalThis.crypto?.randomUUID?.()||`${WRITER}-${Math.random()}`,baseToken:previous?.writer===WRITER?previous.baseToken:version(attempt)};
  attempt.updatedAt=Math.max(Date.now(),(attempt.updatedAt||0)+1);
  // Separate keys keep each tab's debounce/unload recovery independent.
  localSet(recordKey('recovery',attempt),attempt);
  return true;
}
async function compareAndSave(snapshot){
  const db=await openDb();if(!db)return null;
  return new Promise((resolve,reject)=>{
    try{
      const transaction=db.transaction('attempts','readwrite'),store=transaction.objectStore('attempts'),req=store.get(snapshot.id);let outcome;
      req.onsuccess=()=>{
        const {committed,recovery}=localRecords(snapshot.id),current=mergeAttempts([...committed,...(req.result?[req.result]:[])]).get(snapshot.id);
        if(!canAdvanceThroughRecovery(current,snapshot,recovery)){outcome={saved:false,current};return;}
        store.put(snapshot);outcome={saved:true};
      };
      transaction.oncomplete=()=>resolve(outcome);
      transaction.onerror=transaction.onabort=()=>reject(transaction.error||new Error('Storage error'));
    }catch(error){reject(error);}
  });
}
export async function saveAttempt(attempt,{checkpointed=false}={}){
  if(!checkpointed&&!checkpoint(attempt))return false;
  const snapshot=structuredClone(attempt),previous=pending.get(snapshot.id)||Promise.resolve();
  const write=async()=>{
    let outcome;
    try{outcome=await compareAndSave(snapshot);}catch{}
    if(outcome?.saved===false)return conflict(snapshot,outcome.current);
    if(!outcome){
      const {committed,recovery}=localRecords(snapshot.id),current=mergeAttempts(committed).get(snapshot.id);
      if(!canAdvanceThroughRecovery(current,snapshot,recovery))return conflict(snapshot,current);
    }
    // The per-writer record mirrors IndexedDB for synchronous checks and keeps
    // fallback writes from different tabs independent, including without Locks.
    const mirrored=localSet(recordKey('saved',snapshot),snapshot);
    const all=localGet('attempts',{});
    if(outcome){if(all[snapshot.id]){delete all[snapshot.id];localSet('attempts',all);}}
    else{all[snapshot.id]=snapshot;if(!localSet('attempts',all)&&!mirrored)return false;}
    const key=recordKey('recovery',snapshot);if(version(localGet(key))===version(snapshot))localRemove(key);
    if(localGet('recovery')?.id===snapshot.id)localRemove('recovery');
    return true;
  };
  const job=previous.catch(()=>{}).then(()=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(PREFIX+snapshot.id,write):write());
  pending.set(snapshot.id,job);
  try{return await job;}finally{if(pending.get(snapshot.id)===job)pending.delete(snapshot.id);}
}
export async function listAttempts(){
  let all=[];
  try{const result=await tx('readonly',store=>store.getAll());if(Array.isArray(result))all=result;}catch{}
  const {committed,recovery}=localRecords();
  return [...mergeAttempts([...all,...committed],recovery).values()].sort((a,b)=>b.startedAt-a.startedAt);
}
export async function syncAttempt(attempt){
  let durable;
  try{const result=await tx('readonly',store=>store.get(attempt.id));if(result?.id===attempt.id)durable=result;}catch{}
  const {committed,recovery}=localRecords(attempt.id),current=mergeAttempts([...(durable?[durable]:[]),...committed],recovery).get(attempt.id);
  if(current&&!canAdvance(current,attempt))conflict(attempt,current);
}
export async function deleteAttempt(id){
  try{await tx('readwrite',store=>store.delete(id));}catch{warn();}
  const all=localGet('attempts',{});delete all[id];if(Object.keys(all).length)localSet('attempts',all);else localRemove('attempts');
  const {committed,recovery}=localRecords(id);for(const a of [...committed,...recovery])if(a.id===id&&a.storageVersion){localRemove(recordKey('saved',a));localRemove(recordKey('recovery',a));}
  if(localGet('recovery')?.id===id)localRemove('recovery');
}
