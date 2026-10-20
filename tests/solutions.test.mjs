import test from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATE_CATALOG,generateQuestions} from '../js/bank.js';
import {solutionSteps,resultFeedback,canShowSolutions} from '../js/solutions.js';
import {buildReportLayout} from '../js/export.js';

test('all 800 question families have a useful solution and preserve the original question',()=>{
  assert.equal(TEMPLATE_CATALOG.length,800);
  for(const row of TEMPLATE_CATALOG){
    const q=generateQuestions({grade:row.grade,templateIds:[row.id],seed:1430})[0];
    const before=JSON.stringify(q),steps=solutionSteps(q);
    assert.ok(steps.length>=2,`${row.id}: at least two steps`);
    assert.ok(steps.every(s=>typeof s==='string'&&s.trim().length>4),row.id);
    assert.ok(!steps.join(' ').match(/undefined|NaN|Infinity/),row.id);
    assert.equal(JSON.stringify(q),before);
  }
});

test('legacy numeral conversion and tracing give actual intermediate values',()=>{
  const q={templateId:'g8-bases-binary',topicId:'g8-bases',prompt:'Переведите число 101101₂ в десятичную систему.',answer:'45'};
  assert.ok(solutionSteps(q).join(' ').includes('1 × 2^5'));
  assert.ok(solutionSteps(q).join(' ').includes('45'));
  const loop={templateId:'g8-algorithms-while',code:'x = 3\nk = 0\nwhile x < 12:\n    x += 4\n    k += 1\nprint(k)',answer:'3'};
  assert.ok(solutionSteps(loop).join(' ').includes('3 → 7 → 11 → 15'));
  assert.ok(solutionSteps(loop).join(' ').includes('k = 3'));
});

test('motivation follows final mark and never appears before a completed grade',()=>{
  const quotes=new Set();
  for(const mark of [2,3,4,5]){
    const value=resultFeedback({mark,pending:0});assert.equal(value.mark,mark);assert.ok(value.quote&&value.next&&value.signature);quotes.add(value.quote);
    assert.equal(canShowSolutions({phase:'active',result:{mark,pending:0}}),false);
    assert.equal(canShowSolutions({phase:'finished',result:{mark,pending:0}}),true);
    assert.equal(canShowSolutions({phase:'finished',result:{mark,pending:1}}),false);
  }
  assert.equal(quotes.size,4);
  assert.equal(resultFeedback({mark:null,pending:1}),null);
});

test('completed control export includes ordered steps, reference code and grade motivation',()=>{
  const report={mode:'control',mark:3,score:5,maxScore:10,percent:50,pending:0,includeSolutions:true,motivation:resultFeedback({mark:3}),questions:[{kind:'program',title:'Сумма',prompt:'Сложите два числа',points:10,score:5,studentAnswer:'print(0)',programCode:'print(0)',answer:'a = int(input())\nb = int(input())\nprint(a + b)',solutionSteps:['Считываем два целых числа.','Складываем их значения и выводим сумму.']}]};
  const text=value=>buildReportLayout(value).pages.flatMap(p=>p.commands).map(c=>c.text||'').join('\n');
  const final=text(report);assert.ok(final.includes('1. Считываем два целых числа.'));assert.ok(final.includes('print(a + b)'));assert.ok(final.includes('print(0)'));assert.ok(final.includes(report.motivation.quote));
  const pending=text({...report,pending:1,mark:null});assert.ok(!pending.includes('print(a + b)'));assert.ok(!pending.includes(report.motivation.quote));assert.ok(pending.includes('print(0)'));
});
