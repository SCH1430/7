export const PROFILES = [
  { id:'quick', title:'Короткая проверочная', count:5, minutes:12 },
  { id:'thematic', title:'Тематическая контрольная', count:10, minutes:25 },
  { id:'final', title:'Итоговая за класс', count:15, minutes:40 }
];
export const STRICT_LIMIT = 3;
export function deadlinePassed(attempt, now=Date.now()) { return attempt.phase==='active' && attempt.mode==='control' && now >= attempt.endAt; }
export function event(attempt,type,label,now=Date.now(),extra={}) { const item={type,label,at:now,...extra}; attempt.events.push(item); return item; }
export function hideAttempt(attempt,now=Date.now()) {
  if (attempt.phase!=='active' || attempt.mode!=='control' || attempt.hiddenStartAt!=null) return false;
  attempt.hiddenStartAt=now;
  event(attempt,'hidden','Страница стала скрытой',now);
  return true;
}
export function showAttempt(attempt,now=Date.now()) {
  if (attempt.hiddenStartAt==null) return null;
  const start=attempt.hiddenStartAt;
  attempt.hiddenStartAt=null;
  return event(attempt,'return','Возврат к работе',now,{durationMs:Math.max(0,now-start),hiddenAt:start});
}
export function conductSummary(attempt,now=Date.now()) {
  const hidden=attempt.events.filter(e=>e.type==='hidden');
  const durationMs=attempt.events.filter(e=>e.type==='return').reduce((n,e)=>n+(e.durationMs||0),0)+(attempt.hiddenStartAt!=null?Math.max(0,now-attempt.hiddenStartAt):0);
  return { departures:hidden.length,durationMs,needsReview:hidden.length>=2 };
}
export const DEFAULT_THRESHOLDS=Object.freeze({five:85,four:70,three:50});
export function markFromPercent(percent,thresholds=DEFAULT_THRESHOLDS) {
  const scale=thresholds&&typeof thresholds==='object'?{...DEFAULT_THRESHOLDS,...thresholds}:DEFAULT_THRESHOLDS;
  return percent>=scale.five?5:percent>=scale.four?4:percent>=scale.three?3:2;
}
export function calculateResult(questions,responses,thresholds=DEFAULT_THRESHOLDS) {
  const maxScore=questions.reduce((n,q)=>n+q.points,0);
  const score=Math.round(questions.reduce((n,q)=>n+(responses[q.id]?.score||0),0)*100)/100;
  const percent=maxScore?Math.round(score/maxScore*100):0;
  const pending=questions.filter(q=>q.kind==='program'&&responses[q.id]?.gradingUnavailable).length;
  return {score,maxScore,percent,mark:pending?null:markFromPercent(score/maxScore*100,thresholds),pending};
}
export function normalizeOutput(value) { return String(value).replace(/\r\n?/g,'\n').split('\n').map(s=>s.trimEnd()).join('\n').trim(); }
export function formatDuration(seconds) { const s=Math.max(0,Math.floor(seconds)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
