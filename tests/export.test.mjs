import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildReportLayout, createPdf, createPngZip, renderReportPages, safeFilename } from '../js/export.js';

const report = {
  appName: 'Код 1430', studentName: 'Демонстрационный ученик', schoolClass: '9А', grade: 9,
  topicTitle: 'Алгоритмы и программирование', variant: '1430-09', mode: 'control', profileTitle: 'Тематическая контрольная',
  attemptId: 'demo-1430-2026-10-20', startedAt: '2026-10-20T12:00:00Z', finishedAt: '2026-10-20T12:25:10Z',
  elapsedSeconds: 1510, score: 5, maxScore: 6, percent: 83.33, mark: 4,
  finishReason: 'Сдано учеником', policySummary: '30 минут. Уходы фиксируются. Оценка знаний и события контроля учитываются отдельно.',
  tools: { calculator: true, python: true }, includeSolutions: true,
  events: [{ type: 'start', at: '2026-10-20T12:00:00Z' }, { type: 'hidden', at: '2026-10-20T12:10:00Z' }, { type: 'visible', at: '2026-10-20T12:10:12Z', durationMs: 12000 }, { type: 'finish', at: '2026-10-20T12:25:10Z' }],
  questions: [
    { id: '1', kind: 'number', title: 'Двоичная система счисления', prompt: 'Переведите двоичное число 101101₂ в десятичную систему. В ответ запишите целое число.', answer: '45', studentAnswer: '41', explanation: 'SOLUTION_AFTER_GRADE: 32 + 8 + 4 + 1 = 45.', points: 1, score: 0, correct: false },
    { id: '2', kind: 'choice', title: 'Условие в алгоритме', prompt: 'Выберите результат выражения 12 > 8 и 5 < 7.', options: [{ value: 'a', label: 'Ложь' }, { value: 'b', label: 'Истина' }], answer: 'b', studentAnswer: 'b', explanation: 'Оба сравнения истинны.', points: 1, score: 1, correct: true },
    { id: '3', kind: 'program', title: 'Сумма чисел', prompt: 'Программа получает на вход число N, затем N целых чисел, каждое в отдельной строке. Выведите их сумму. Условие распространяется и на отрицательные числа.', answer: 'n = int(input())\ns = 0\nfor _ in range(n):\n    s += int(input())\nprint(s)', studentAnswer: '', points: 3, score: 3, correct: true,
      programCode: 'n = int(input())\ns = 0\nfor i in range(n):\n    value = int(input())\n    s += value\nprint(s)', programInput: '3\n10\n-2\n5', programOutput: '13\n', explanation: 'Пример решения.' },
    { id: '4', kind: 'text', title: 'Трассировка программы', prompt: 'Что выведет программа? Запишите число.', code: 's = 0\nfor i in range(1, 5):\n    s += i\nprint(s)', answer: '10', studentAnswer: '10', points: 1, score: 1, correct: true },
  ],
};

assert.equal(safeFilename('../Иванов: 9/А?.pdf'), '_Иванов__9_А_.pdf');
assert.equal(safeFilename('CON'), 'file_CON');
assert.equal(safeFilename('   '), '_');
const layout = buildReportLayout(report);
assert.ok(layout.pages.length >= 2, 'Report should paginate');
const allText = layout.pages.flatMap(page => page.commands.filter(c => c.type === 'text').map(c => c.text)).join('\n');
assert.ok(allText.includes('41'), 'Original wrong student answer must survive');
assert.ok(allText.includes('Ложь') && allText.includes('Истина'), 'Choice options must be printed');
assert.ok(allText.includes('SOLUTION_AFTER_GRADE'), 'Completed control must include solutions after the grade');
assert.ok(allText.includes('Программа ученика') && allText.includes('print(s)'), 'Program code must be printed');
assert.ok(allText.includes('1. Двоичная система счисления'));
assert.ok(allText.includes('Зафиксировано скрытий страницы: 1'));
assert.ok(allText.includes('0 мин 12 с'));
for (const page of layout.pages) {
  for (const command of page.commands) {
    if (command.type === 'text') assert.ok(command.y >= 0 && command.y + command.style.size < layout.height, 'Text outside page');
    if (command.type === 'rect') assert.ok(command.y >= 0 && command.y + command.height <= layout.height, 'Rect outside page');
  }
}
const training = buildReportLayout({ ...report, mode: 'training' });
assert.ok(training.pages.flatMap(p => p.commands).some(c => c.text?.includes('SOLUTION_AFTER_GRADE')), 'Training solution missing');
assert.ok(training.pages.flatMap(p => p.commands).some(c => c.text === 'Правильный ответ: 45'), 'Correct answer must be separate from student answer');
const pending = buildReportLayout({ ...report, pending: 1, mark: 4 });
const pendingText = pending.pages.flatMap(p => p.commands).filter(c => c.type === 'text').map(c => c.text).join(' ');
assert.ok(pendingText.includes('Предварительный результат'), 'Incomplete grading must label provisional points');
assert.ok(pendingText.includes('Проверка программ не завершена. Баллы предварительные; оценка не выставлена.'), 'Incomplete grading warning missing');
assert.ok(!pendingText.includes('Оценка: 4'), 'Incomplete grading must never show a final mark');
assert.ok(!pendingText.includes('SOLUTION_AFTER_GRADE'), 'Pending grading must not show solutions');
const layoutText = value => value.pages.flatMap(p => p.commands).filter(c => c.type === 'text').map(c => c.text).join('\n');
const singleReference = layoutText(buildReportLayout({
  ...report,
  questions: [{ ...report.questions[2], answer: 'print(1234567)', programCode: 'print(0)' }],
}));
assert.equal(singleReference.split('print(1234567)').length - 1, 1, 'Reference program must appear once across the exported pages');
assert.ok(singleReference.includes('print(0)'), 'Removing duplicate reference code must preserve the student program');
const namedReport = {
  ...report, workTitle: 'Алгоритмы · работа №2', difficultyTitle: 'Смешанная сложность',
  variant: '01 · набор ABC1430', seriesId: 'ABC1430',
  questions: report.questions.map((question, index) => ({ ...question, difficultyTitle: index ? 'Повышенная' : 'Базовая', difficultyReason: 'Необязательное пояснение уровня' })),
};
const namedText = layoutText(buildReportLayout(namedReport));
assert.ok(namedText.includes('Работа: Алгоритмы · работа №2'), 'Work title missing');
assert.ok(namedText.includes('Сложность работы: Смешанная сложность'), 'Work difficulty missing');
assert.ok(namedText.includes('Вариант: 01 · набор ABC1430'), 'Human-readable variant missing');
assert.equal(namedText.split('ABC1430').length - 1, 1, 'Series already present in variant must not be duplicated');
assert.ok(namedText.includes('Сложность задания: Базовая') && namedText.includes('Сложность задания: Повышенная'), 'Question difficulty labels missing');
const separateSeriesText = layoutText(buildReportLayout({ ...namedReport, variant: '02' }));
assert.ok(separateSeriesText.includes('Набор вариантов: ABC1430'), 'Series missing when variant has no series label');
const retryText = layoutText(buildReportLayout({ ...namedReport, mode: 'training', sourceVariant: '03 · набор OLD1430', sourceAttemptId: 'source-attempt-1430', pending: 1 }));
assert.ok(retryText.includes('Тренировка ошибок · исходный вариант: 03 · набор OLD1430'), 'Source variant missing from retry report');
assert.ok(retryText.includes('Исходная попытка: source-attempt-1430'), 'Source attempt ID missing from retry report');
assert.ok(retryText.includes('оценка не выставлена'), 'New metadata must preserve pending warning');
assert.ok(!allText.includes('undefined') && !allText.includes('Сложность работы:'), 'Legacy report must work without new metadata');
const constructorReport = {
  ...namedReport, constructorWorkId: 'work-constructor-1430', constructorRevision: 3,
  gradingScale: 'Оценка 5 — от 90%; 4 — от 75%; 3 — от 55%; 2 — ниже 55%.',
};
const constructorLayout = buildReportLayout(constructorReport);
const constructorHeader = layoutText({ pages: [constructorLayout.pages[0]] }).replace(/\n/g, ' ');
assert.ok(constructorHeader.includes('Код созданной работы: work-constructor-1430 · Редакция: 3'), 'Constructor identity and revision missing from header');
assert.ok(constructorHeader.includes(`Шкала оценивания: ${constructorReport.gradingScale}`), 'Custom grading thresholds must be preserved in the header');
assert.ok(!constructorHeader.includes('85%') && !constructorHeader.includes('70%'), 'Custom thresholds must not be replaced by defaults');
const revisionOnlyText = layoutText(buildReportLayout({ ...report, constructorRevision: 1 }));
assert.ok(revisionOnlyText.includes('Редакция: 1') && !revisionOnlyText.includes('Код созданной работы:'), 'Revision must work without an optional work ID');
assert.ok(!allText.includes('Шкала оценивания:') && !allText.includes('Редакция:'), 'Legacy reports must omit missing constructor metadata');
for (const page of constructorLayout.pages) {
  for (const command of page.commands) {
    if (command.type === 'text') assert.ok(command.y >= 0 && command.y + command.style.size < constructorLayout.height, 'Constructor report text outside page');
    if (command.type === 'rect') assert.ok(command.y >= 0 && command.y + command.height <= constructorLayout.height, 'Constructor report block outside page');
  }
}
const inputPage = layout.pages.find(p => p.commands.some(c => c.text === 'Входные данные последнего запуска'));
assert.ok(inputPage.commands.some(c => c.text === '-2') && inputPage.commands.some(c => c.text === '5'), 'Small input block must stay on one page');
const veryLong = buildReportLayout({ ...report, questions: [{ ...report.questions[2], programCode: `def calculation():\n${'    print("Проверка длинной строки и отступов: ' + 'х'.repeat(140) + '")\n'}`.repeat(40), programOutput: '' }] });
assert.ok(veryLong.pages.length > 3);
assert.ok(veryLong.pages.flatMap(p => p.commands).some(c => c.text?.includes('продолжение')));
assert.ok(veryLong.pages.flatMap(p => p.commands).some(c => c.text === '↳'));
assert.throws(() => createPdf([]), /Нет страниц/);
assert.throws(() => buildReportLayout(null), /./);

let canvasModule;
const require = createRequire(import.meta.url);
try { canvasModule = require('@napi-rs/canvas'); }
catch { try { canvasModule = require(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', '@napi-rs/canvas')); } catch {} }

if (canvasModule) {
  const { createCanvas, GlobalFonts } = canvasModule;
  // Headless Linux has no Arial/Consolas. Register Cyrillic-capable equivalents for visual QA.
  for (const [path, family] of [
    ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'Arial'],
    ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'Arial'],
    ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'Consolas'],
  ]) if (existsSync(path)) GlobalFonts.registerFromPath(path, family);
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement(tag) { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } };
  const pages = await renderReportPages(report);
  assert.ok(pages.length >= 2);
  assert.equal(pages[0].canvas.width, 1191);
  assert.equal(pages[0].canvas.height, 1685);
  const constructorPages = await renderReportPages(constructorReport);
  assert.ok(constructorPages.length >= 2, 'Constructor metadata must preserve real-canvas pagination');
  assert.ok(constructorPages.every(page => page.canvas.width === 1191 && page.canvas.height === 1685), 'Constructor pages must retain A4 dimensions');
  const pdf = createPdf(pages), pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.type, 'application/pdf');
  assert.equal(pdfBytes.subarray(0, 8).toString(), '%PDF-1.4');
  const pdfText = pdfBytes.toString('latin1');
  const xrefAt = Number(pdfText.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(pdfText.slice(xrefAt, xrefAt + 4), 'xref');
  const xrefLines = pdfText.slice(xrefAt).split('\n');
  const objectCount = Number(xrefLines[1].split(' ')[1]);
  for (let id = 1; id < objectCount; id++) { const offset = Number(xrefLines[2 + id].slice(0, 10)); assert.ok(pdfText.slice(offset).startsWith(`${id} 0 obj`), 'Invalid xref offset'); }
  const zip = await createPngZip(pages, 'Код1430_Демонстрационный_ученик');
  const zipBytes = Buffer.from(await zip.arrayBuffer());
  assert.equal(zip.type, 'application/zip');
  assert.equal(zipBytes.readUInt32LE(0), 0x04034b50);
  const output = process.env.EXPORT_TEST_OUTPUT_DIR;
  if (output) {
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'export-sample.pdf'), pdfBytes);
    await writeFile(join(output, 'export-pages.zip'), zipBytes);
    await writeFile(join(output, 'export-first-page.png'), pages[0].canvas.toBuffer('image/png'));
    await writeFile(join(output, 'export-report.json'), JSON.stringify(report, null, 2));
  }
  console.log(`Export tests passed: ${pages.length} real raster pages, ${pdfBytes.length} PDF bytes, ${zipBytes.length} ZIP bytes; xref, Cyrillic data, preservation of answers, solution visibility, long-code pagination.`);
} else {
  console.log('Export layout tests passed. Optional real-canvas checks skipped (@napi-rs/canvas not installed).');
}
