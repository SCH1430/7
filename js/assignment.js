import { SUPPORTED_BANK_VERSIONS, GRADES, TEMPLATE_CATALOG, isTemplateAvailable } from './bank.js';

/**
 * A work link contains only a bounded, validated configuration in its URL hash.
 * There is no request, account, identity, answer, or server-side storage here.
 * The configuration is NOT signed: a person can edit the URL or client code.
 * Locking settings in the receiving UI is a convenience, not an exam security boundary.
 * Constructor links include their full plan: editing a saved draft cannot change a link.
 */
export const ASSIGNMENT_VERSION = 1;
export const CONSTRUCTOR_ASSIGNMENT_VERSION = 2;
export const MAX_VARIANTS = 30;
const LEGACY_LIMITS = { token: 4096, json: 3072, url: 12288 };
const CONSTRUCTOR_LIMITS = { token: 11000, json: 8192, url: 16384 };
const FIELDS = new Set(['v', 'bankVersion', 'title', 'grade', 'topicId', 'profileId', 'difficulty', 'seed', 'variant', 'mode', 'strict', 'minutes', 'calculator', 'python']);
const CONSTRUCTOR_FIELDS = new Set([...FIELDS, 'workId', 'revision', 'slots', 'thresholds']);
const SLOT_FIELDS = new Set(['templateId', 'points']);
const THRESHOLD_FIELDS = new Set(['five', 'four', 'three']);
const templates = new Map(TEMPLATE_CATALOG.map(template => [template.id, template]));
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const limitsFor = version => version === CONSTRUCTOR_ASSIGNMENT_VERSION ? CONSTRUCTOR_LIMITS : LEGACY_LIMITS;

function fail(message) { throw new Error(`Ссылка на работу: ${message}`); }
function integer(value, minimum, maximum, label) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) fail(`${label}: нужно целое число от ${minimum} до ${maximum}.`);
  return value;
}
function oneOf(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(`${label}: неизвестное значение.`);
  return value;
}
function boolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label}: должно быть логическое значение.`);
  return value;
}
function record(value, allowed, label = 'параметров') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label === 'параметров' ? 'ожидались параметры работы.' : `недопустимый объект ${label}.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`недопустимый объект ${label}.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) fail(`обнаружены неизвестные параметры ${label}.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) fail(`недопустимый объект ${label}.`);
  }
}
function normalizeSlots(value, grade, bankVersion) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30 || Object.getPrototypeOf(value) !== Array.prototype) fail('план должен содержать от 1 до 30 заданий.');
  // Arrays received directly through the API must not run accessor code either.
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) fail('недопустимые параметры плана заданий.');
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail('недопустимый объект плана заданий.');
  }
  return Array.from(value, (slot, index) => {
    record(slot, SLOT_FIELDS, `задания ${index + 1}`);
    const template = typeof slot.templateId === 'string' && templates.get(slot.templateId);
    if (!template || template.grade !== grade || !isTemplateAvailable(template.id, bankVersion)) fail(`задание ${index + 1}: шаблон не найден или не относится к выбранному классу.`);
    return { templateId: template.id, points: integer(slot.points, 1, 10, `Баллы задания ${index + 1}`) };
  });
}
function normalizeThresholds(value) {
  record(value, THRESHOLD_FIELDS, 'шкалы оценок');
  const five = integer(value.five, 1, 100, 'Порог оценки 5');
  const four = integer(value.four, 1, 100, 'Порог оценки 4');
  const three = integer(value.three, 1, 100, 'Порог оценки 3');
  if (!(three < four && four < five)) fail('пороги оценок должны возрастать: 3 < 4 < 5.');
  return { five, four, three };
}

/** Return a fresh object containing only the supported public configuration. */
export function normalizeAssignment(config) {
  // Check descriptors before reading v so accessor properties never execute.
  record(config, CONSTRUCTOR_FIELDS);
  if (![ASSIGNMENT_VERSION, CONSTRUCTOR_ASSIGNMENT_VERSION].includes(config.v)) fail('версия формата не поддерживается. Создайте новую ссылку в этой версии тренажёра.');
  const constructed = config.v === CONSTRUCTOR_ASSIGNMENT_VERSION;
  if (!constructed) record(config, FIELDS);
  if (typeof config.bankVersion !== 'string' || !SUPPORTED_BANK_VERSIONS.includes(config.bankVersion)) fail('версия банка заданий отличается. Откройте подходящую версию тренажёра или создайте новую ссылку; прежний вариант не будет подменён.');
  const grade = integer(config.grade, 7, 11, 'Класс');
  if (typeof config.topicId !== 'string' || config.topicId.length > 80) fail('недопустимая тема.');
  const gradeRow = GRADES.find(row => row.grade === grade);
  if (config.topicId !== 'all' && !gradeRow.topics.some(topic => topic.id === config.topicId)) fail('тема не относится к указанному классу.');
  const profileId = oneOf(config.profileId, constructed ? ['custom'] : ['quick', 'thematic', 'final'], 'Формат');
  if ((profileId === 'final' || constructed) && config.topicId !== 'all') fail(constructed ? 'составленная работа должна использовать общий план тем.' : 'итоговая работа должна включать все темы класса.');
  const difficulty = oneOf(config.difficulty, constructed ? ['mixed'] : ['basic', 'standard', 'advanced', 'mixed'], 'Сложность');
  const seed = integer(config.seed, 0, 0xffffffff, 'Код комплекта');
  const variant = integer(config.variant, 1, MAX_VARIANTS, 'Номер варианта');
  const mode = oneOf(config.mode, ['training', 'control'], 'Режим');
  const strict = boolean(config.strict, 'Строгий контроль');
  const minutes = integer(config.minutes, 5, 120, 'Продолжительность');
  const calculator = boolean(config.calculator, 'Калькулятор');
  const python = boolean(config.python, 'Python');
  if (config.title != null && typeof config.title !== 'string') fail('название должно быть текстом.');
  const title = config.title ?? '';
  if ([...title].length > 80 || /[\u0000-\u001f\u007f]/.test(title)) fail('название должно занимать одну строку длиной до 80 символов.');
  const normalized = { v: config.v, bankVersion: config.bankVersion, title: title.trim(), grade, topicId: config.topicId, profileId, difficulty, seed, variant, mode, strict: mode === 'control' && strict, minutes, calculator, python };
  if (!constructed) return normalized;
  if (typeof config.workId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(config.workId)) fail('недопустимый идентификатор шаблона работы.');
  const revision = integer(config.revision, 1, 1000000, 'Редакция работы');
  const slots = normalizeSlots(config.slots, grade, config.bankVersion);
  const thresholds = normalizeThresholds(config.thresholds);
  if (!python && slots.some(slot => templates.get(slot.templateId).kind === 'program')) fail('в работе есть задания на программу: включите Python.');
  return { ...normalized, workId: config.workId, revision, slots, thresholds };
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Encode a validated configuration; neither student details nor answers are accepted. */
export function encodeAssignment(config) {
  const normalized = normalizeAssignment(config);
  const bytes = encoder.encode(JSON.stringify(normalized));
  if (bytes.length > limitsFor(normalized.v).json) fail('слишком много данных.');
  return base64url(bytes);
}

export function decodeAssignment(token) {
  if (typeof token !== 'string' || !token || token.length > CONSTRUCTOR_LIMITS.token || !/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) fail('повреждён или слишком велик код работы.');
  let bytes;
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4));
    bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch { fail('не удалось прочитать код работы.'); }
  if (bytes.length > CONSTRUCTOR_LIMITS.json || base64url(bytes) !== token) fail('повреждён или слишком велик код работы.');
  let config;
  try { config = JSON.parse(decoder.decode(bytes)); } catch { fail('параметры работы повреждены.'); }
  const normalized = normalizeAssignment(config), limits = limitsFor(normalized.v);
  if (bytes.length > limits.json || token.length > limits.token) fail('повреждён или слишком велик код работы.');
  return normalized;
}

function parseUrl(value) {
  if (typeof value !== 'string' || value.length > CONSTRUCTOR_LIMITS.url) fail('недопустимый адрес.');
  let url;
  try { url = new URL(value); } catch { fail('нужен полный адрес сайта.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail('разрешён только адрес сайта HTTP или HTTPS без учётных данных.');
  return url;
}

export function makeAssignmentUrl(config, baseUrl) {
  const url = parseUrl(baseUrl);
  // Do not copy an unrelated query or hash which could contain personal information.
  url.search = '';
  url.hash = `work=${encodeAssignment(config)}`;
  if (url.href.length > limitsFor(config.v).url) fail('адрес получился слишком длинным.');
  return url.href;
}

export function readAssignmentUrl(value) {
  const url = parseUrl(value);
  if (!url.hash) return null;
  const fragment = url.hash.slice(1);
  const params = new URLSearchParams(fragment);
  if (!params.has('work')) return null;
  if (params.getAll('work').length !== 1 || [...params.keys()].some(key => key !== 'work')) fail('в адресе должны быть параметры только одной работы.');
  const token = params.get('work');
  // A canonical generated link contains plain base64url; reject hidden alternate encodings.
  if (fragment !== `work=${token}`) fail('недопустимая запись параметров в адресе.');
  const config = decodeAssignment(token);
  if (value.length > limitsFor(config.v).url) fail('недопустимый адрес.');
  return config;
}
