import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,formatCalculator} from '../js/calculator.js';
import {hideAttempt,showAttempt,conductSummary,deadlinePassed,markFromPercent,calculateResult,normalizeOutput} from '../js/session.js';
test('calculator precedence, unary power, division and modulo',()=>{
  for(const [s,n] of [['(12+8)/4',5],['2^3^2',512],['-2^2',-4],['2^-3',.125],['7//2',3],['-7//2',-4],['-7%2',1],['0,5×8',4],['1e3 + 2',1002]])assert.equal(calculate(s),n,s);
  assert.equal(formatCalculator(calculate('0.1+0.2')),'0.3');
  for(const s of ['1/0','1//0','1%0','alert(1)','2(3)','(1+2','1+','NaN','9**99999'])assert.throws(()=>calculate(s),s);
});
test('visibility episodes deduplicate and preserve elapsed time',()=>{
  const a={phase:'active',mode:'control',hiddenStartAt:null,events:[],endAt:3000};
  assert.equal(hideAttempt(a,1000),true);assert.equal(hideAttempt(a,1200),false);
  assert.equal(showAttempt(a,1800).durationMs,800);assert.equal(showAttempt(a,2000),null);
  hideAttempt(a,2500);assert.deepEqual(conductSummary(a,3000),{departures:2,durationMs:1300,needsReview:true});
  assert.equal(deadlinePassed(a,3000),true);a.phase='finished';assert.equal(hideAttempt(a,4000),false);
});
test('grades use exact ratio and pending code has no final mark',()=>{
  assert.deepEqual([49,50,69,70,84,85].map(markFromPercent),[2,3,3,4,4,5]);
  assert.equal(calculateResult([{id:'a',points:1000}],{a:{score:849}}).mark,4);
  assert.equal(calculateResult([{id:'p',kind:'program',points:3}],{p:{gradingUnavailable:true}}).mark,null);
  assert.equal(normalizeOutput(' 12  \r\n13\n'),'12\n13');
});
test('custom thresholds use weighted scores and exact boundaries',()=>{
  const thresholds={five:90,four:75,three:40};
  const questions=[{id:'large',points:9},{id:'small',points:1}];
  assert.equal(calculateResult(questions,{large:{score:9},small:{score:0}},thresholds).mark,5);
  assert.equal(calculateResult(questions,{large:{score:0},small:{score:1}},thresholds).mark,2);
  for(const [score,mark] of [[399,2],[400,3],[749,3],[750,4],[899,4],[900,5]])
    assert.equal(calculateResult([{id:'q',points:1000}],{q:{score}},thresholds).mark,mark);
  assert.equal(calculateResult([{id:'p',kind:'program',points:10}],{p:{score:10,gradingUnavailable:true}},thresholds).mark,null);
  assert.deepEqual(thresholds,{five:90,four:75,three:40});
});
