const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tasks.js');
const C = require('../js/core.js');

const profile = { firstName: 'Иван', lastName: 'Иванов', className: '11 А' };
const makeSession = () => C.createSession(profile, 12, 30, 47, 100000);

test('all 12 generators: 6,000 variants satisfy independent mathematical constraints', () => {
  const seen = new Set();
  let fractional = false;
  for (let seed = 1; seed <= 500; seed++) {
    const questions = T.generateQuestions(12, seed);
    assert.equal(questions.length, 12);
    assert.equal(new Set(questions.map(q => q.type)).size, 12);
    for (const q of questions) {
      const p = q.params;
      const a = q.answer;
      seen.add(q.type);
      fractional ||= !Number.isInteger(a);
      assert.ok(Number.isFinite(a) && a > 0);
      assert.ok(q.paragraphs.length >= 2 && q.solution.length >= 2);
      switch (q.type) {
        case 'image-size': {
          const bits = a * 8192 / (p.width * p.height);
          assert.ok(Number.isInteger(bits));
          assert.ok(2 ** bits >= p.colors && 2 ** (bits - 1) < p.colors);
          break;
        }
        case 'image-colors': {
          const bits = Math.log2(a);
          const budget = p.memory * 8192;
          assert.ok(Number.isInteger(bits));
          assert.ok(p.width * p.height * bits <= budget);
          assert.ok(p.width * p.height * (bits + 1) > budget);
          break;
        }
        case 'image-resolution':
          assert.equal(a / p.memory, p.scale * p.scale * p.newDepth / p.oldDepth);
          break;
        case 'image-compression': {
          const bits = Math.log2(a);
          const fileKB = (b) => p.width * p.height * b / 8192 * p.kept / 100 + p.header;
          assert.ok(Number.isInteger(bits));
          assert.ok(fileKB(bits) <= p.limit && fileKB(bits + 1) > p.limit);
          break;
        }
        case 'audio-size':
          assert.equal(a * 8388608 / p.seconds, p.frequency * p.depth * p.channels);
          break;
        case 'audio-duration': {
          const bitsPerSecond = p.frequency * p.depth * p.channels;
          assert.ok(Number.isInteger(a));
          assert.ok(a * bitsPerSecond <= p.memory * 8388608);
          assert.ok((a + 1) * bitsPerSecond > p.memory * 8388608);
          break;
        }
        case 'audio-depth':
          assert.equal(p.frequency * p.channels * p.seconds * a, p.memory * 8388608);
          break;
        case 'audio-conversion':
          assert.equal(a * p.oldDepth, p.memory * p.factor * p.newDepth * 2);
          break;
        case 'image-transfer':
          assert.equal(a * p.speed, p.width * p.height * p.depth);
          break;
        case 'audio-transfer':
          assert.equal(a * p.speed * 100, p.frequency * p.depth * p.channels * p.seconds * p.kept);
          break;
        case 'image-batch': {
          const bytes = p.width * p.height * p.depth / 8 + p.header * 1024;
          const budget = p.speed * 1024 * p.seconds;
          assert.ok(Number.isInteger(a));
          assert.ok(a * bytes <= budget && (a + 1) * bytes > budget);
          break;
        }
        case 'audio-speed': {
          const size = p.frequency * p.depth * p.channels * p.seconds;
          assert.ok(Number.isInteger(a));
          assert.ok(a * p.transferSeconds >= size && (a - 1) * p.transferSeconds < size);
          break;
        }
        default: assert.fail('Unknown generator');
      }
    }
  }
  assert.equal(seen.size, 12);
  assert.ok(fractional, 'Fractional answers must be exercised');
});

test('random variants are reproducible and differ between seeds', () => {
  assert.deepEqual(T.generateQuestions(24, 428), T.generateQuestions(24, 428));
  assert.notDeepEqual(T.generateQuestions(12, 428), T.generateQuestions(12, 429));
  assert.notDeepEqual(T.generateQuestions(12, 428).map(q => q.type), T.generateQuestions(12, 429).map(q => q.type));
});

test('all session sizes cover all categories and have no repeated questions', () => {
  for (const count of C.COUNTS) {
    for (let seed = 0; seed < 60; seed++) {
      const qs = T.generateQuestions(count, seed);
      assert.equal(new Set(qs.map(q => q.category)).size, 3);
      assert.equal(new Set(qs.map(q => q.type + JSON.stringify(q.params))).size, count);
      assert.equal(new Set(qs.map(q => q.id)).size, count);
    }
  }
});

test('numeric input accepts decimal comma, spaces and zero without accepting expressions', () => {
  for (const value of ['1,5', '1.5', ' 1,50 ']) assert.equal(C.parseAnswer(value), 1.5);
  assert.equal(C.parseAnswer('1 024'), 1024);
  assert.equal(C.parseAnswer('0'), 0);
  for (const value of ['', ' ', 'abc', '1e3', '0x10', '-2', 'Infinity', '1,2,3', '8 бит', '2+2']) assert.equal(C.parseAnswer(value), null);
  assert.equal(C.isCorrect('001,50', 1.5), true);
  assert.equal(C.isCorrect('', 0), false);
  assert.equal(C.isCorrect('1.500001', 1.5), false);
});

test('five-point grades use exact score, including boundaries', () => {
  for (const [correct, expected] of [[0,1],[19,1],[20,2],[49,2],[50,3],[69,3],[70,4],[84,4],[85,5],[100,5]]) {
    assert.equal(C.grade(correct, 100).grade, expected);
  }
  assert.equal(C.grade(17, 20).grade, 5);
  assert.equal(C.grade(10, 12).grade, 4);
  assert.equal(C.grade(849, 1000).grade, 4);
  assert.throws(() => C.grade(1, 0), RangeError);
});

test('session normalizes profile and rejects invalid settings', () => {
  const s = C.createSession({ ...profile, firstName: ' Иван ' }, 8, 15, 1, 0);
  assert.equal(s.profile.firstName, 'Иван');
  assert.equal(s.deadline, 900000);
  assert.equal(C.validateSession(s), true);
  assert.throws(() => C.createSession({ ...profile, firstName: ' ' }, 12, 30, 1));
  assert.throws(() => C.createSession(profile, 9, 30, 1));
  assert.throws(() => C.createSession(profile, 12, 0, 1));
});

test('deadline survives serialization and includes background time', () => {
  const s = makeSession();
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(C.remainingMs(copy, 110000), 1790000);
  assert.equal(C.remainingMs(copy, 1900000), 0);
  C.finishSession(copy, 'manual', 2000000);
  assert.equal(copy.finishedAt, 1900000);
  assert.equal(copy.finishReason, 'timeout');
});

test('away events deduplicate blur and visibility and cap duration at deadline', () => {
  const s = makeSession();
  C.beginAway(s, 'blur', 101000);
  C.beginAway(s, 'hidden', 101050);
  C.beginAway(s, 'hidden', 102000);
  assert.equal(s.events.length, 1);
  assert.deepEqual(s.events[0].kinds, ['blur', 'hidden']);
  C.endAway(s, 106000);
  C.endAway(s, 107000);
  assert.equal(s.awayMs, 5000);
  assert.equal(s.awaySince, null);
  C.beginAway(s, 'hidden', 1800000);
  C.finishSession(s, 'timeout', 2000000);
  assert.equal(s.awayMs, 105000);
  assert.equal(s.events[1].endedAt, 1900000);
  C.beginAway(s, 'blur', 2000001);
  assert.equal(s.events.length, 2);
});

test('finishing is idempotent and scores only nonempty exact answers', () => {
  const s = makeSession();
  const qs = T.generateQuestions(s.count, s.seed);
  s.answers = qs.map(q => String(q.answer).replace('.', ','));
  s.answers[0] = '';
  s.answers[1] = 'invalid';
  C.finishSession(s, 'manual', 150000);
  C.finishSession(s, 'timeout', 2000000);
  assert.equal(s.finishedAt, 150000);
  assert.equal(s.finishReason, 'manual');
  assert.equal(C.scoreSession(s).correct, 10);
  assert.equal(C.scoreSession(s).grade, 4);
});

test('malformed persisted sessions fail validation without throwing', () => {
  assert.equal(C.validateSession(null), false);
  assert.equal(C.validateSession({}), false);
  assert.equal(C.validateSession(makeSession()), true);
  for (const changes of [
    { seed: -1 }, { version: 99 }, { answers: [] }, { flags: [1] }, { current: 12 },
    { deadline: 0 }, { awayMs: -1 }, { events: [{ type: 'away', at: 1 }] },
    { profile: {} }, { awayKinds: ['madeup'] }, { finishedAt: 'yesterday' },
  ]) assert.equal(C.validateSession({ ...makeSession(), ...changes }), false);
});
