import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, DIFFICULTIES, TEMPLATE_CATALOG, generateQuestions, generateBlueprint, generatePracticeQuestions, checkAnswer } from '../js/bank.js';

const rank = { basic: 0, standard: 1, advanced: 2 };
const structure = questions => questions.map(({ templateId, topicId, difficulty, kind, points }) => ({ templateId, topicId, difficulty, kind, points }));
const taskContent = q => JSON.stringify([q.prompt, q.code || '', (q.options || []).map(o => o.label).sort()]);

test('difficulty follows concepts and every topic supports all three levels', () => {
  assert.deepEqual(DIFFICULTIES.map(d => d.id), ['basic', 'standard', 'advanced', 'mixed']);
  for (const row of GRADES) {
    for (const topic of row.topics) {
      const byLevel = new Map();
      for (const difficulty of Object.keys(rank)) {
        const questions = generateQuestions({ grade: row.grade, topicId: topic.id, count: 10, difficulty, seed: 1430 });
        assert.equal(questions.length, 10);
        assert.ok(questions.every(q => q.difficulty === difficulty), `${topic.id}: level filtering`);
        assert.ok(questions.every(q => q.difficultyTitle && q.difficultyReason), 'classification has a pedagogical reason');
        byLevel.set(difficulty, new Set(questions.map(q => q.templateId)));
        for (const q of questions) if (q.kind !== 'program') assert.equal(checkAnswer(q, q.answer).correct, true);
      }
      for (const a of byLevel.get('basic')) assert.ok(!byLevel.get('standard').has(a) && !byLevel.get('advanced').has(a), 'different levels use different concepts, not number labels');
      for (const a of byLevel.get('standard')) assert.ok(!byLevel.get('advanced').has(a));
    }
  }
  const simple = generateQuestions({ grade: 9, count: 1, templateIds: ['g9-programming-linear'] })[0];
  const loop = generateQuestions({ grade: 9, count: 1, templateIds: ['g9-programming-multiples'] })[0];
  assert.equal(simple.difficulty, 'basic');
  assert.equal(loop.difficulty, 'advanced');
});

test('mixed work increases difficulty while retaining topic balance', () => {
  for (const row of GRADES) {
    for (const count of [1, 2, 3, 5, 10, 15]) {
      const questions = generateQuestions({ grade: row.grade, count, difficulty: 'mixed', seed: 'school1430' });
      assert.equal(questions.length, count);
      for (let i = 1; i < count; i++) assert.ok(rank[questions[i - 1].difficulty] <= rank[questions[i].difficulty]);
      if (count >= 3) assert.equal(new Set(questions.map(q => q.difficulty)).size, 3);
      const counts = row.topics.map(t => questions.filter(q => q.topicId === t.id).length);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, 'grade work samples topics evenly');
    }
  }
});

test('thirty variants share the exact task plan, difficulty, type and maximum score', () => {
  let variantWorks = 0;
  for (const row of GRADES) {
    for (const topic of [{ id: 'all' }, ...row.topics]) {
      for (const difficulty of ['basic', 'standard', 'advanced', 'mixed']) {
        const config = { grade: row.grade, topicId: topic.id, count: 10, seed: 'control-1430', difficulty };
        const first = generateQuestions({ ...config, variant: 1 });
        const blueprint = generateBlueprint(config);
        assert.deepEqual(blueprint, first.map(q => q.templateId));
        const structure1 = structure(first);
        const uniqueWorks = new Set();
        for (let variant = 1; variant <= 30; variant++) {
          const questions = generateQuestions({ ...config, variant });
          assert.deepEqual(structure(questions), structure1, `${row.grade}/${topic.id}/${difficulty}/${variant}`);
          assert.deepEqual(questions, generateQuestions({ ...config, variant }), 'link configuration reproduces exactly');
          uniqueWorks.add(JSON.stringify(questions.map(taskContent)));
          variantWorks++;
        }
        assert.equal(uniqueWorks.size, 30, 'variants change actual task data, not only the displayed number');
      }
    }
  }
  assert.equal(variantWorks, 3000);
});

test('practice preserves missed concepts, uses fresh data and does not change the original work', () => {
  const covered = new Set();
  for (const row of GRADES) {
    for (const topic of row.topics) {
      const original = generateQuestions({ grade: row.grade, topicId: topic.id, templateIds: TEMPLATE_CATALOG.filter(t=>t.topicId===topic.id).map(t=>t.id), seed: 1430, variant: 2 });
      const originalJson = JSON.stringify(original);
      const practice = generatePracticeQuestions(original, { seed: 1430, variant: 2 });
      assert.equal(practice.length, original.length);
      assert.equal(JSON.stringify(original), originalJson);
      assert.deepEqual(practice, generatePracticeQuestions(original, { seed: 1430, variant: 2 }));
      const sourceContents = new Set(original.map(taskContent));
      practice.forEach((q, i) => {
        covered.add(q.templateId);
        assert.equal(q.templateId, original[i].templateId);
        assert.equal(q.difficulty, original[i].difficulty);
        assert.equal(q.practiceOf, original[i].id);
        assert.notEqual(q.id, original[i].id);
        assert.equal(q.kind, original[i].kind);
        assert.equal(q.points, original[i].points);
        assert.equal(q.practiceRepeated, false);
        assert.ok(!sourceContents.has(taskContent(q)), q.templateId);
      });
    }
  }
  assert.equal(covered.size, 800);
});

test('finite question families explicitly mark exhausted fresh-data choices', () => {
  const original = generateQuestions({ grade: 8, templateIds: Array(7).fill('g8-logic-rows'), seed: 81 });
  assert.equal(new Set(original.map(taskContent)).size, 7);
  const practice = generatePracticeQuestions(original.slice(0, 1), { seed: 'fresh' });
  assert.equal(practice[0].practiceRepeated, false);
  const exhausted = generatePracticeQuestions(original, { seed: 'all-values-already-seen' });
  assert.ok(exhausted.every(q => q.practiceRepeated && q.practiceNote));
});

test('invalid variants, difficulty and mismatched template plans fail clearly', () => {
  for (const variant of [0, 31, 1.5, NaN, 'no']) assert.throws(() => generateQuestions({ grade: 7, variant }), /варианта/);
  assert.throws(() => generateQuestions({ grade: 7, difficulty: 'impossible' }), /уровень/);
  assert.throws(() => generateQuestions({ grade: 7, templateIds: ['g9-programming-linear'] }), /Шаблон/);
  assert.throws(() => generateQuestions({ grade: 7, templateIds: [] }), /плане/);
  assert.throws(() => generateQuestions({ grade: 7, difficulty: 'basic', templateIds: ['g7-algorithms-reverse'] }), /Шаблон/);
  assert.deepEqual(generatePracticeQuestions([], {}), []);
  assert.throws(() => generatePracticeQuestions([{ templateId: 'unknown' }]), /тип/);
});
