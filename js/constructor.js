import { BANK_VERSION, SUPPORTED_BANK_VERSIONS, GRADES, TEMPLATE_CATALOG, generateQuestions, isTemplateAvailable } from './bank.js';

export const CONSTRUCTOR_FORMAT = 'code1430-constructor';
export const CONSTRUCTOR_SCHEMA_VERSION = 1;
export const MAX_CONSTRUCTOR_SLOTS = 30;
export const MAX_CONSTRUCTOR_BYTES = 128 * 1024;
export const DEFAULT_THRESHOLDS = Object.freeze({ five: 85, four: 70, three: 50 });
const catalog = new Map(TEMPLATE_CATALOG.map(template => [template.id, template]));
const DRAFT_FIELDS = new Set(['id', 'revision', 'bankVersion', 'title', 'grade', 'mode', 'minutes', 'strict', 'calculator', 'python', 'thresholds', 'slots', 'seed']);
const SLOT_FIELDS = new Set(['id', 'templateId', 'points']);
const THRESHOLD_FIELDS = new Set(['five', 'four', 'three']);
const ENVELOPE_FIELDS = new Set(['format', 'schemaVersion', 'bankVersion', 'draft']);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function fail(message) { throw new Error(message); }
function plainObject(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label}: ожидается объект.`);
  for (const key of Object.keys(value)) if (!fields.has(key)) fail(`${label}: недопустимое поле «${key}».`);
  return value;
}
function integer(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) fail(`${label}: введите целое число от ${min} до ${max}.`);
  return value;
}
function boolean(value, label) { if (typeof value !== 'boolean') fail(`${label}: ожидается включённый или выключенный параметр.`); return value; }
function identity(value, label) { if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(`${label}: недопустимый идентификатор.`); return value; }
function variantNumber(value) { return integer(value, 1, 30, 'Номер варианта'); }
function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function makeSeed() {
  if (globalThis.crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
}

export function createConstructorDraft({ grade = 7 } = {}) {
  return validateConstructorDraft({
    id: makeId(), revision: 1, title: 'Новая работа', grade,
    mode: 'control', minutes: 25, strict: false, calculator: false, python: true,
    thresholds: { ...DEFAULT_THRESHOLDS }, slots: [], seed: makeSeed(),
  });
}

/** Validation returns a detached canonical copy; it never edits the input draft. */
export function validateConstructorDraft(value, { ready = false } = {}) {
  plainObject(value, DRAFT_FIELDS, 'Шаблон работы');
  const id = identity(value.id, 'Шаблон работы');
  const revision = integer(value.revision, 1, 1000000, 'Редакция');
  const bankVersion = value.bankVersion ?? BANK_VERSION;
  if (!SUPPORTED_BANK_VERSIONS.includes(bankVersion)) fail('Версия банка не поддерживается. Исходные задания не будут подменены.');
  if (typeof value.title !== 'string' || value.title.length > 80) fail('Название работы должно быть строкой до 80 символов.');
  const title = value.title.trim();
  if (ready && !title) fail('Введите название работы перед выдачей.');
  const grade = integer(value.grade, 7, 11, 'Класс');
  if (!GRADES.some(row => row.grade === grade)) fail('Выберите класс от 7 до 11.');
  if (!['training', 'control'].includes(value.mode)) fail('Выберите тренировку или контроль.');
  const mode = value.mode;
  const minutes = integer(value.minutes, 5, 120, 'Время работы');
  const strict = boolean(value.strict, 'Строгий контроль');
  const calculator = boolean(value.calculator, 'Калькулятор');
  const python = boolean(value.python, 'Python');
  const seed = integer(value.seed, 0, 4294967295, 'Номер набора');
  plainObject(value.thresholds, THRESHOLD_FIELDS, 'Пороги оценок');
  const five = integer(value.thresholds.five, 1, 100, 'Порог оценки 5');
  const four = integer(value.thresholds.four, 1, 100, 'Порог оценки 4');
  const three = integer(value.thresholds.three, 1, 100, 'Порог оценки 3');
  if (!(three < four && four < five)) fail('Пороги должны возрастать: оценка 3 < оценка 4 < оценка 5.');
  if (!Array.isArray(value.slots) || value.slots.length > MAX_CONSTRUCTOR_SLOTS) fail(`В работе должно быть не более ${MAX_CONSTRUCTOR_SLOTS} заданий.`);
  if (ready && !value.slots.length) fail('Добавьте хотя бы одно задание перед выдачей.');
  const ids = new Set();
  const slots = value.slots.map((slot, index) => {
    plainObject(slot, SLOT_FIELDS, `Задание ${index + 1}`);
    const slotId = identity(slot.id, `Задание ${index + 1}`);
    if (ids.has(slotId)) fail(`Задание ${index + 1}: идентификатор позиции повторяется.`);
    ids.add(slotId);
    if (typeof slot.templateId !== 'string' || !catalog.has(slot.templateId)) fail(`Задание ${index + 1}: шаблон не найден в банке.`);
    if (!isTemplateAvailable(slot.templateId, bankVersion)) fail(`Задание ${index + 1}: шаблон недоступен в указанной версии банка.`);
    const template = catalog.get(slot.templateId);
    if (template.grade !== grade) fail(`Задание ${index + 1} относится к ${template.grade} классу. Выберите задания ${grade} класса.`);
    const points = integer(slot.points, 1, 10, `Баллы задания ${index + 1}`);
    return { id: slotId, templateId: slot.templateId, points };
  });
  if (ready && !python && slots.some(slot => catalog.get(slot.templateId).kind === 'program')) fail('В работе есть задания на программу. Включите Python перед выдачей.');
  return { id, revision, bankVersion, title, grade, mode, minutes, strict: mode === 'control' && strict, calculator, python, thresholds: { five, four, three }, slots, seed };
}

/** Same slot order and weights for every variant; only generated source data changes. */
export function generateConstructorQuestions(draft, { variant = 1, bankVersion } = {}) {
  const value = validateConstructorDraft(bankVersion === undefined ? draft : { ...draft, bankVersion }, { ready: true });
  const number = variantNumber(variant);
  return generateQuestions({
    grade: value.grade, topicId: 'all', difficulty: 'mixed', seed: value.seed,
    variant: number, bankVersion: value.bankVersion, templateIds: value.slots.map(slot => slot.templateId),
  }).map((question, index) => ({ ...question, points: value.slots[index].points, slotId: value.slots[index].id }));
}

export function summarizeDraft(draft) {
  const value = validateConstructorDraft(draft);
  const levels = { basic: 0, standard: 0, advanced: 0 };
  let maxScore = 0, hasPrograms = false;
  const repeated = new Map();
  for (const slot of value.slots) {
    const template = catalog.get(slot.templateId);
    levels[template.difficulty]++;
    maxScore += slot.points;
    hasPrograms ||= template.kind === 'program';
    repeated.set(slot.templateId, (repeated.get(slot.templateId) || 0) + 1);
  }
  const warnings = [];
  if (!value.slots.length) warnings.push('Добавьте задания из каталога.');
  if (!value.title) warnings.push('Перед выдачей нужно назвать работу.');
  if (hasPrograms && !value.python) warnings.push('Для заданий на программу нужно включить Python.');
  const frequent = [...repeated.entries()].filter(([, count]) => count > 1);
  if (frequent.length) warnings.push(`Повторяющихся типов заданий: ${frequent.length}. Исходные данные будут меняться; проверьте разнообразие в предпросмотре.`);
  const rank = { basic: 0, standard: 1, advanced: 2 };
  if (value.slots.some((slot, index) => index > 0 && rank[catalog.get(slot.templateId).difficulty] < rank[catalog.get(value.slots[index - 1].templateId).difficulty])) warnings.push('Сложность заданий не возрастает последовательно. Порядок сохранится как задано.');
  return { count: value.slots.length, maxScore, levels, hasPrograms, warnings };
}

/** A complete immutable-by-value issue snapshot, with no student identity or answers. */
export function createConstructorAssignment(draft, { variant = 1 } = {}) {
  const value = validateConstructorDraft(draft, { ready: true });
  return {
    v: 2, bankVersion: value.bankVersion, title: value.title, grade: value.grade,
    topicId: 'all', profileId: 'custom', difficulty: 'mixed', seed: value.seed,
    variant: variantNumber(variant), mode: value.mode, strict: value.strict,
    minutes: value.minutes, calculator: value.calculator, python: value.python,
    workId: value.id, revision: value.revision,
    slots: value.slots.map(({ templateId, points }) => ({ templateId, points })),
    thresholds: { ...value.thresholds },
  };
}

export function serializeConstructorDraft(draft) {
  const { bankVersion, ...value } = validateConstructorDraft(draft);
  return JSON.stringify({ format: CONSTRUCTOR_FORMAT, schemaVersion: CONSTRUCTOR_SCHEMA_VERSION, bankVersion, draft: value }, null, 2);
}

export function parseConstructorDraft(text) {
  if (typeof text !== 'string') fail('Шаблон должен быть текстовым JSON-файлом.');
  if (text.length > MAX_CONSTRUCTOR_BYTES || new TextEncoder().encode(text).length > MAX_CONSTRUCTOR_BYTES) fail('Файл шаблона слишком большой. Допустимо не более 128 Кбайт.');
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { fail('Не удалось прочитать JSON. Выберите файл шаблона Код 1430.'); }
  plainObject(value, ENVELOPE_FIELDS, 'Файл шаблона');
  if (value.format !== CONSTRUCTOR_FORMAT) fail('Это не файл шаблона конструктора Код 1430.');
  if (value.schemaVersion !== CONSTRUCTOR_SCHEMA_VERSION) fail('Версия файла шаблона не поддерживается.');
  if (!SUPPORTED_BANK_VERSIONS.includes(value.bankVersion)) fail('Версия банка в шаблоне отличается. Нужна совместимая версия тренажёра; задания не будут подменены.');
  plainObject(value.draft, DRAFT_FIELDS, 'Шаблон работы');
  if (value.draft.bankVersion !== undefined && value.draft.bankVersion !== value.bankVersion) fail('Версия банка внутри шаблона не совпадает с версией файла.');
  return validateConstructorDraft({ ...value.draft, bankVersion: value.bankVersion });
}
