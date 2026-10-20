import { GRADES, TEMPLATE_CATALOG, DIFFICULTIES, generateQuestions, generateBlueprint, isTemplateAvailable } from './bank.js';
import { createConstructorDraft, validateConstructorDraft, generateConstructorQuestions, summarizeDraft, serializeConstructorDraft, parseConstructorDraft } from './constructor.js';
import { downloadBlob, safeFilename } from './export.js';
import { renderPrompt, renderCode } from './presentation.js';

const CATALOG = new Map(TEMPLATE_CATALOG.map(item => [item.id, item]));
const WORKING_KEY = 'code1430:constructor:working';
const SAVED_KEY = 'code1430:constructor:templates';
const MAX_FILE_BYTES = 128 * 1024;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = value => structuredClone(value);
const uuid = () => globalThis.crypto?.randomUUID?.() || `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const randomSeed = () => globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
const signature = draft => JSON.stringify({ ...draft, id: undefined, revision: undefined });
const levelTitle = id => DIFFICULTIES.find(item => item.id === id)?.title || id;
const answerText = q => q.options?.find(option => option.value === q.answer)?.label ?? q.answer;
const searchText = value => String(value ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const kindTitle = kind => kind === 'program' ? 'Программа на Python' : kind === 'choice' ? 'Выбор ответа' : 'Короткий ответ';
const pointsTitle = points => `${points} ${points === 1 ? 'балл' : points < 5 ? 'балла' : 'баллов'}`;
const taskMeta = item => `<div class="ctor-task-meta"><span class="difficulty-chip ${item.difficulty}">${esc(item.difficultyTitle)}</span><span>${kindTitle(item.kind)}</span><span>${pointsTitle(item.points)}</span></div>`;

/** Persistent controller; render() may be called after the host uses root for another screen. */
export function createConstructorController({ root, onStart = () => {}, onIssue = () => {}, onNotice = () => {} }) {
  if (!root?.ownerDocument) throw new TypeError('Для конструктора нужен корневой элемент.');
  const view = root.ownerDocument.defaultView;
  let storage;
  try { storage = view.localStorage; } catch { storage = null; }
  let records = [], unreadableRecords = [], draft = createConstructorDraft(), variant = 1, baseSignature = null;
  let topicFilter = 'all', levelFilter = 'all', searchQuery = '', addCount = 1, selectedSaved = '';
  const samples = new Map();
  let previewOpen = false, showAnswers = false, confirmation = null, dragSlot = null, disposed = false;
  let status = 'Черновик на этом устройстве', warning = '', loadWarning = '';

  try {
    const raw = storage?.getItem(SAVED_KEY);
    if (raw) {
      const values = JSON.parse(raw);
      if (!Array.isArray(values)) throw new Error();
      records = values.flatMap(record => {
        try { const parsed = parseConstructorDraft(record.data); return [{ id: parsed.id, updatedAt: Number(record.updatedAt) || 0, draft: parsed }]; }
        catch { unreadableRecords.push(record);loadWarning = 'Некоторые сохранённые шаблоны несовместимы с этой версией банка. Их исходные записи не изменены.'; return []; }
      });
    }
    const working = storage?.getItem(WORKING_KEY);
    if (working) {
      const value = JSON.parse(working);
      draft = parseConstructorDraft(value.data);
      variant = Number.isInteger(value.variant) && value.variant >= 1 && value.variant <= 30 ? value.variant : 1;
      if (typeof value.baseSignature === 'string') {
        const baseline = JSON.parse(value.baseSignature);
        baseSignature = signature(validateConstructorDraft({ ...baseline, id: draft.id, revision: draft.revision, bankVersion: baseline.bankVersion ?? draft.bankVersion }));
      }
    }
  } catch { loadWarning = 'Не удалось восстановить черновик. Можно импортировать сохранённый файл шаблона.'; }
  if (!storage) loadWarning = 'Хранилище браузера недоступно. Сохраняйте шаблоны отдельным файлом.';
  // Keep issued snapshots even if browser storage rejects their writes.
  const latestDrafts = new Map(records.map(record => [record.id, clone(record.draft)]));
  const resumed = latestDrafts.get(draft.id);
  if (baseSignature === signature(draft) && (!resumed || draft.revision > resumed.revision)) latestDrafts.set(draft.id, clone(draft));

  const notice = message => { warning = String(message); onNotice(warning); if (isVisible()) updateStatus(); };
  const isVisible = () => Boolean(root.querySelector('[data-ctor-root]'));
  const dirty = () => baseSignature !== signature(draft);
  function summary() {
    try { return summarizeDraft(draft); }
    catch {
      const levels = { basic: 0, standard: 0, advanced: 0 };
      draft.slots.forEach(slot => { const t = CATALOG.get(slot.templateId); if (t) levels[t.difficulty]++; });
      return { count: draft.slots.length, maxScore: draft.slots.reduce((n, slot) => n + (Number(slot.points) || 0), 0), levels, hasPrograms: draft.slots.some(slot => CATALOG.get(slot.templateId)?.kind === 'program'), warnings: [] };
    }
  }
  function persistWorking() {
    try {
      const data = serializeConstructorDraft(draft);
      if (!storage) throw new Error();
      storage.setItem(WORKING_KEY, JSON.stringify({ data, variant, baseSignature }));
      status = dirty() ? 'Черновик сохранён · есть изменения' : `Шаблон сохранён · редакция ${draft.revision}`;
      return true;
    } catch {
      status = 'Черновик не сохранён';
      return false;
    }
  }
  function updateStatus() {
    const statusNode = root.querySelector('#ctor-status');
    if (statusNode) statusNode.textContent = status;
    const warningNode = root.querySelector('#ctor-message');
    if (warningNode) { warningNode.textContent = warning || loadWarning; warningNode.hidden = !(warning || loadWarning); }
    const totals = root.querySelector('#ctor-totals');
    if (totals) {
      const value = summary();
      totals.innerHTML = `<strong>${value.count} / 30 заданий</strong><strong>${value.maxScore} баллов</strong><span>${['basic', 'standard', 'advanced'].map(level => `${levelTitle(level)}: ${value.levels[level]}`).join(' · ')}</span>`;
    }
  }
  function changed({ repaint = true } = {}) {
    warning = '';
    if (summary().hasPrograms) draft.python = true;
    const stored = persistWorking();
    if (!stored && storage) warning = 'Не удалось сохранить черновик. Проверьте настройки и скачайте файл шаблона.';
    if (repaint) render(); else updateStatus();
  }
  function commit({ ready = false, notify = true } = {}) {
    let normalized = validateConstructorDraft(draft, { ready });
    const last = latestDrafts.get(normalized.id);
    const currentSignature = signature(normalized);
    if (last && currentSignature === signature(last)) normalized.revision = Math.max(normalized.revision, last.revision);
    else {
      if (baseSignature != null && currentSignature !== baseSignature) normalized.revision++;
      if (last && normalized.revision <= last.revision) normalized.revision = last.revision + 1;
    }
    normalized = validateConstructorDraft(normalized, { ready });
    const next = [{ id: normalized.id, updatedAt: Date.now(), draft: clone(normalized) }, ...records.filter(record => record.id !== normalized.id)];
    draft = normalized;baseSignature = signature(draft);
    latestDrafts.set(draft.id, clone(draft));
    try {
      if (!storage) throw new Error();
      storage.setItem(SAVED_KEY, JSON.stringify([...next.map(record => ({ id: record.id, updatedAt: record.updatedAt, data: serializeConstructorDraft(record.draft) })), ...unreadableRecords]));
      records = next;selectedSaved = draft.id;
      warning = '';persistWorking();
      if (notify) onNotice(`Шаблон сохранён · редакция ${draft.revision}`);
    } catch {
      persistWorking();status = `Шаблон не сохранён в браузере · редакция ${draft.revision}`;
      notice('Не удалось сохранить шаблон в браузере. Скачайте его файл. Работа может быть открыта или выдана по ссылке.');
    }
    return clone(normalized);
  }
  function ask(type, message, extra = {}) { confirmation = { type, message, ...extra }; render(); }
  function acceptDraft(value, { copy = false, selected = '', baseline = false } = {}) {
    let normalized = validateConstructorDraft(value);
    if (copy) normalized = { ...normalized, id: uuid(), revision: 1, title: `${normalized.title || 'Работа'} — копия`.slice(0, 80), slots: normalized.slots.map(slot => ({ ...slot, id: uuid() })) };
    const saved = records.find(record => record.id === normalized.id)?.draft;
    draft = clone(normalized);baseSignature = copy ? null : baseline ? signature(normalized) : saved ? signature(saved) : null;
    selectedSaved = selected;topicFilter = levelFilter = 'all';searchQuery = '';variant = 1;previewOpen = false;showAnswers = false;confirmation = null;
    changed();
  }
  function resetDraft(grade = draft.grade) { acceptDraft(createConstructorDraft({ grade })); }
  function addTemplate(id, count = addCount) {
    const item = CATALOG.get(id);
    if (!item || item.grade !== draft.grade || !isTemplateAvailable(id, draft.bankVersion)) return;
    const remaining = 30 - draft.slots.length;
    if (!remaining) { notice('В работе уже 30 заданий. Удалите одно, чтобы добавить новое.'); return; }
    const total = Math.min(remaining, Math.max(1, Math.min(10, Number(count) || 1)));
    for (let i = 0; i < total; i++) draft.slots.push({ id: uuid(), templateId: id, points: item.points });
    if (item.kind === 'program') draft.python = true;
    changed();
    if (total < count) notice(`Добавлено ${total}: достигнут предел 30 заданий.`);
  }
  function fillPreset() {
    const ids = generateBlueprint({ grade: draft.grade, topicId: 'all', difficulty: 'mixed', count: 5, seed: draft.seed, bankVersion: draft.bankVersion });
    draft.slots = ids.map(templateId => ({ id: uuid(), templateId, points: CATALOG.get(templateId).points }));
    changed();
  }
  function moveSlot(id, delta) {
    const index = draft.slots.findIndex(slot => slot.id === id), next = index + delta;
    if (index < 0 || next < 0 || next >= draft.slots.length) return;
    [draft.slots[index], draft.slots[next]] = [draft.slots[next], draft.slots[index]];changed();
  }
  function previewMarkup() {
    if (!previewOpen) return '';
    let questions;
    try { questions = generateConstructorQuestions(draft, { variant }); }
    catch (error) { return `<section class="ctor-preview"><h2>Предпросмотр</h2><p class="notice warning">${esc(error.message)}</p></section>`; }
    return `<section class="ctor-preview"><div class="section-heading"><h2>Предпросмотр работы</h2><button class="button text-button" data-ctor-action="close-preview">Свернуть ↑</button></div><div class="ctor-preview-tools"><label class="field-label">Вариант<select data-ctor-field="variant" aria-label="Вариант предпросмотра">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${variant === i + 1 ? 'selected' : ''}>Вариант ${i + 1}</option>`).join('')}</select></label><label class="check-label"><input type="checkbox" data-ctor-field="answers" ${showAnswers ? 'checked' : ''}> Показать ответы и объяснения</label></div><p class="tiny muted">Во всех вариантах сохраняются типы заданий, порядок и баллы. Меняются исходные данные.</p><div class="ctor-preview-list">${questions.map((q, index) => `<article class="ctor-preview-question"><div class="ctor-row-heading"><h3><span class="ctor-preview-number">${index + 1}</span>${esc(q.title)}</h3></div>${taskMeta(q)}${renderPrompt(q.prompt, { className: 'ctor-condition' })}${q.code ? renderCode(q.code, { label: 'Код из условия', copy: true }) : ''}${q.options ? `<ol class="ctor-options">${q.options.map(option => `<li>${esc(option.label)}</li>`).join('')}</ol>` : ''}${q.repeated ? `<p class="notice warning">${esc(q.generationNote)}</p>` : ''}${showAnswers ? `<div class="ctor-solution"><h4>${q.kind === 'program' ? 'Пример программы' : 'Правильный ответ'}</h4>${q.kind === 'program' ? renderCode(String(answerText(q)), { label: 'Пример решения', copy: true }) : renderPrompt(String(answerText(q)), { className: 'ctor-answer' })}${renderPrompt(q.explanation, { className: 'ctor-explanation' })}</div>` : ''}</article>`).join('')}</div></section>`;
  }
  function catalogItems() {
    const terms = searchText(searchQuery).split(/\s+/).filter(Boolean);
    return TEMPLATE_CATALOG.filter(item => item.grade === draft.grade && isTemplateAvailable(item.id, draft.bankVersion)
      && (topicFilter === 'all' || item.topicId === topicFilter)
      && (levelFilter === 'all' || item.difficulty === levelFilter)
      && terms.every(term => searchText(`${item.title} ${item.topicTitle}`).includes(term)));
  }
  function hasCatalogFilters() { return Boolean(searchQuery || topicFilter !== 'all' || levelFilter !== 'all'); }
  function catalogCount(visible) { return `Найдено ${visible.length} из ${TEMPLATE_CATALOG.filter(item => item.grade === draft.grade && isTemplateAvailable(item.id, draft.bankVersion)).length} типов`; }
  function catalogSampleMarkup(item) {
    const sampleKey = `${draft.bankVersion}:${item.id}`;
    if (!samples.has(sampleKey)) samples.set(sampleKey, generateQuestions({ grade: draft.grade, topicId: 'all', seed: 1430, variant: 1, bankVersion: draft.bankVersion, templateIds: [item.id] })[0]);
    const q = samples.get(sampleKey);
    return `${renderPrompt(q.prompt, { className: 'ctor-condition' })}${q.code ? renderCode(q.code, { label: 'Код из условия', copy: true }) : ''}${q.options ? `<ol class="ctor-options">${q.options.map(o => `<li>${esc(o.label)}</li>`).join('')}</ol>` : ''}<p class="ctor-difficulty-reason"><strong>Почему этот уровень</strong>${esc(item.difficultyReason)}</p>`;
  }
  function catalogResultsMarkup(visible) {
    if (!visible.length) return `<div class="ctor-no-results"><h3>Ничего не найдено</h3><p>Попробуйте другое название или уберите ограничения по теме и сложности.</p><button class="button secondary" data-ctor-action="reset-filters">Сбросить все фильтры</button></div>`;
    // Conditions are only needed when a teacher opens a sample. Building all
    // 160 hidden prompts on every search adds substantial markup and work.
    return visible.map(item => `<article class="ctor-template"><div class="ctor-row-heading"><h3>${esc(item.title)}</h3><button class="button secondary ctor-add" data-ctor-action="add" data-ctor-template="${item.id}" aria-label="Добавить ${esc(item.title)}" title="Добавить задание"><span aria-hidden="true">＋</span></button></div><p class="ctor-template-topic">${esc(item.topicTitle)}</p>${taskMeta(item)}<details data-ctor-sample="${item.id}"><summary>Условие и сложность</summary><div class="ctor-sample"></div></details></article>`).join('');
  }
  function handleSampleToggle(event) {
    const details = event.target;
    if (!details.open || !details.dataset?.ctorSample || !root.contains(details)) return;
    const sample = details.querySelector('.ctor-sample');
    const item = CATALOG.get(details.dataset.ctorSample);
    if (sample && !sample.hasChildNodes() && item?.grade === draft.grade && isTemplateAvailable(item.id, draft.bankVersion)) sample.innerHTML = catalogSampleMarkup(item);
  }
  function updateCatalogResults() {
    const visible = catalogItems(), list = root.querySelector('[data-ctor-results]');
    if (list) { list.innerHTML = catalogResultsMarkup(visible);list.scrollTop = 0; }
    const count = root.querySelector('[data-ctor-result-count]');
    if (count) count.textContent = catalogCount(visible);
    const reset = root.querySelector('[data-ctor-reset-filters]');
    if (reset) reset.disabled = !hasCatalogFilters();
  }
  function catalogMarkup() {
    const topics = GRADES.find(item => item.grade === draft.grade).topics, visible = catalogItems();
    return `<section class="ctor-panel ctor-catalog"><div class="section-heading"><h2>Банк заданий</h2><span class="ctor-grade-tag">${draft.grade} класс</span></div><label class="field-label ctor-search">Поиск по названию или теме<input type="search" data-ctor-field="search" value="${esc(searchQuery)}" placeholder="Например, двоичный код" autocomplete="off" spellcheck="false" aria-controls="ctor-catalog-results"></label><div class="ctor-filters"><label class="field-label">Тема<select data-ctor-field="topic"><option value="all">Все темы</option>${topics.map(topic => `<option value="${topic.id}" ${topicFilter === topic.id ? 'selected' : ''}>${esc(topic.title)}</option>`).join('')}</select></label><label class="field-label">Сложность<select data-ctor-field="level"><option value="all">Все уровни</option>${DIFFICULTIES.filter(level => level.id !== 'mixed').map(level => `<option value="${level.id}" ${levelFilter === level.id ? 'selected' : ''}>${esc(level.title)}</option>`).join('')}</select></label><label class="field-label">Добавлять по<select data-ctor-field="addCount">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${addCount === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label></div><div class="ctor-result-bar"><p data-ctor-result-count role="status" aria-live="polite" aria-atomic="true">${catalogCount(visible)}</p><button class="button text-button" data-ctor-action="reset-filters" data-ctor-reset-filters ${hasCatalogFilters() ? '' : 'disabled'}>Сбросить</button></div><div id="ctor-catalog-results" class="ctor-catalog-list" data-ctor-results>${catalogResultsMarkup(visible)}</div></section>`;
  }
  function slotsMarkup() {
    return `<section class="ctor-panel ctor-work"><div class="section-heading"><h2>Состав работы</h2><button class="button text-button" data-ctor-action="clear" ${draft.slots.length ? '' : 'disabled'}>Очистить</button></div>${draft.slots.length ? `<ol class="ctor-slots">${draft.slots.map((slot, index) => { const item = CATALOG.get(slot.templateId);return `<li class="ctor-slot" data-ctor-slot="${slot.id}" draggable="true"><div class="ctor-slot-number" aria-hidden="true">${index + 1}</div><div class="ctor-slot-body"><h3>${esc(item.title)}</h3><p class="tiny muted">${esc(item.topicTitle)} · ${esc(item.difficultyTitle)}</p><div class="ctor-slot-controls"><label class="field-label">Баллы<input type="number" min="1" max="10" step="1" data-ctor-points="${slot.id}" value="${slot.points}" aria-label="Баллы задания ${index + 1}"></label><div class="button-row"><button class="ctor-small" data-ctor-action="up" data-ctor-id="${slot.id}" ${index === 0 ? 'disabled' : ''} aria-label="Задание ${index + 1} выше">↑</button><button class="ctor-small" data-ctor-action="down" data-ctor-id="${slot.id}" ${index === draft.slots.length - 1 ? 'disabled' : ''} aria-label="Задание ${index + 1} ниже">↓</button><button class="ctor-small" data-ctor-action="duplicate" data-ctor-id="${slot.id}" aria-label="Повторить тип задания ${index + 1}">＋</button><button class="ctor-small" data-ctor-action="remove" data-ctor-id="${slot.id}" aria-label="Удалить задание ${index + 1}">×</button></div></div></div></li>`; }).join('')}</ol><p class="tiny muted">Перетаскивайте карточки или меняйте порядок стрелками. Уровень задан выбранным типом.</p>` : '<div class="ctor-empty"><span aria-hidden="true">＋</span><h3>Добавьте первое задание</h3><p>Выберите тип в банке слева или начните с готового набора.</p><button class="button secondary" data-ctor-action="preset">Смешанная работа · 5 заданий</button></div>'}</section>`;
  }
  function render() {
    if (disposed) return;
    const value = summary();
    const selected = selectedSaved || (records.some(item => item.id === draft.id) ? draft.id : '');
    root.innerHTML = `<div data-ctor-root><div class="ctor-intro"><div><span class="eyebrow">КОД [1430] · КОНСТРУКТОР</span><h1>Собрать работу</h1><p class="muted">Выберите задания и правила. Один план — до 30 равноценных вариантов.</p></div><button class="button secondary" data-ctor-action="new">Новый шаблон</button></div><div id="ctor-message" class="notice warning" role="status" ${warning || loadWarning ? '' : 'hidden'}>${esc(warning || loadWarning)}</div>${confirmation ? `<div class="notice ctor-confirm" role="alert"><p>${esc(confirmation.message)}</p><div class="button-row"><button class="button primary" data-ctor-action="confirm">Подтвердить</button><button class="button secondary" data-ctor-action="cancel">Отмена</button></div></div>` : ''}
    <section class="ctor-library"><label class="field-label">Мои шаблоны<select data-ctor-field="saved"><option value="">Выберите сохранённый шаблон</option>${records.map(record => `<option value="${record.id}" ${selected === record.id ? 'selected' : ''}>${esc(record.draft.title || 'Без названия')} · ${record.draft.grade} кл. · ред. ${record.draft.revision}</option>`).join('')}</select></label><div class="button-row"><button class="button secondary" data-ctor-action="load" ${selected ? '' : 'disabled'}>Открыть</button><button class="button secondary" data-ctor-action="copy" ${selected ? '' : 'disabled'}>Копия</button><button class="button text-button" data-ctor-action="delete" ${selected ? '' : 'disabled'}>Удалить</button><button class="button text-button" data-ctor-action="import">Импорт файла</button><input type="file" id="ctor-import" accept=".json,application/json" hidden></div></section>
    <section class="ctor-panel ctor-basics"><label class="field-label">Название работы<input type="text" maxlength="80" data-ctor-field="title" value="${esc(draft.title)}" placeholder="Например, Системы счисления · 8 класс"></label><label class="field-label">Класс<select data-ctor-field="grade">${GRADES.map(item => `<option value="${item.grade}" ${draft.grade === item.grade ? 'selected' : ''}>${item.grade} класс</option>`).join('')}</select></label><span class="tiny muted ctor-revision">Редакция ${draft.revision}${dirty() ? ' · черновик изменён' : ''}</span></section>
    <div class="ctor-grid">${catalogMarkup()}${slotsMarkup()}</div>
    <section class="ctor-panel ctor-settings"><div class="section-heading"><h2>Правила работы</h2><span class="tiny muted">Задаются до выдачи</span></div><div class="ctor-settings-grid"><label class="field-label">Режим<select data-ctor-field="mode"><option value="control" ${draft.mode === 'control' ? 'selected' : ''}>Контроль</option><option value="training" ${draft.mode === 'training' ? 'selected' : ''}>Тренировка</option></select></label><label class="field-label">Время контроля, минут<input type="number" min="5" max="120" step="1" data-ctor-field="minutes" value="${draft.minutes}" ${draft.mode === 'training' ? 'disabled' : ''}></label><div class="ctor-checks"><label class="check-label"><input type="checkbox" data-ctor-field="calculator" ${draft.calculator ? 'checked' : ''}> Калькулятор</label><label class="check-label"><input type="checkbox" data-ctor-field="python" ${draft.python ? 'checked' : ''} ${value.hasPrograms ? 'disabled' : ''}> Python${value.hasPrograms ? ' · обязателен для заданий' : ''}</label></div><label class="check-label"><input type="checkbox" data-ctor-field="strict" ${draft.strict ? 'checked' : ''} ${draft.mode === 'training' ? 'disabled' : ''}> Завершить после трёх скрытий страницы</label></div><details class="ctor-thresholds"><summary>Пороги оценок</summary><div class="ctor-threshold-grid">${[['five', '5'], ['four', '4'], ['three', '3']].map(([key, mark]) => `<label class="field-label">Оценка ${mark} — от, %<input type="number" min="1" max="100" step="1" data-ctor-threshold="${key}" value="${draft.thresholds[key]}"></label>`).join('')}</div><p class="tiny muted">Пороги должны возрастать: для 3 меньше, чем для 4, для 4 меньше, чем для 5. Ниже порога 3 выставляется 2.</p></details></section>
    <section class="ctor-panel ctor-summary"><div id="ctor-totals" class="ctor-totals"><strong>${value.count} / 30 заданий</strong><strong>${value.maxScore} баллов</strong><span>${['basic', 'standard', 'advanced'].map(level => `${levelTitle(level)}: ${value.levels[level]}`).join(' · ')}</span></div>${value.warnings.length ? `<ul class="ctor-warnings">${value.warnings.map(message => `<li>${esc(message)}</li>`).join('')}</ul>` : ''}<div class="ctor-issue-controls"><label class="field-label">Вариант<select data-ctor-field="variant" aria-label="Вариант для запуска и выдачи">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${variant === i + 1 ? 'selected' : ''}>${i + 1} из 30</option>`).join('')}</select></label><button class="button text-button" data-ctor-action="reseed">Другие исходные данные ↻</button><span class="tiny muted">Набор ${Number(draft.seed).toString(36).toUpperCase().padStart(7, '0')}</span></div><div class="button-row"><button class="button secondary" data-ctor-action="preview" ${value.count ? '' : 'disabled'}>Предпросмотр</button><button class="button secondary" data-ctor-action="save">Сохранить шаблон</button><button class="button text-button" data-ctor-action="export">Скачать шаблон</button><button class="button secondary" data-ctor-action="start" ${value.count ? '' : 'disabled'}>Пройти работу</button><button class="button primary" data-ctor-action="issue" ${value.count ? '' : 'disabled'}>Получить ссылки →</button></div><p id="ctor-status" class="tiny muted ctor-save-status" role="status">${esc(status)}</p><p class="tiny muted">Изменения шаблона создают новую редакцию. Ссылки, уже выданные ученикам, сохраняют прежний состав и правила.</p></section>${previewMarkup()}</div>`;
    updateStatus();
  }
  function selectedRecord() { const id = root.querySelector('[data-ctor-field="saved"]')?.value || selectedSaved;return records.find(record => record.id === id); }
  async function handleClick(event) {
    const button = event.target.closest('[data-ctor-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.ctorAction, id = button.dataset.ctorId;
    try {
      if (action === 'add') addTemplate(button.dataset.ctorTemplate);
      else if (action === 'reset-filters') {
        searchQuery = '';topicFilter = levelFilter = 'all';
        for (const field of ['search', 'topic', 'level']) { const input = root.querySelector(`[data-ctor-field="${field}"]`);if (input) input.value = field === 'search' ? '' : 'all'; }
        updateCatalogResults();root.querySelector('[data-ctor-field="search"]')?.focus();
      }
      else if (action === 'up' || action === 'down') moveSlot(id, action === 'up' ? -1 : 1);
      else if (action === 'remove') { draft.slots = draft.slots.filter(slot => slot.id !== id);changed(); }
      else if (action === 'duplicate') { const index = draft.slots.findIndex(slot => slot.id === id);if (draft.slots.length >= 30) notice('Можно добавить не более 30 заданий.');else if (index >= 0) { draft.slots.splice(index + 1, 0, { ...draft.slots[index], id: uuid() });changed(); } }
      else if (action === 'new') { if (dirty() && draft.slots.length) ask('new', 'Создать новый черновик? Сохранённые шаблоны останутся в списке; несохранённые изменения текущего черновика будут заменены.');else resetDraft(); }
      else if (action === 'clear') ask('clear', 'Удалить все задания из текущего черновика? Сохранённый шаблон останется без изменений.');
      else if (action === 'preset') fillPreset();
      else if (action === 'cancel') { confirmation = null;render(); }
      else if (action === 'confirm') {
        const pending = confirmation;confirmation = null;
        if (pending?.type === 'new') resetDraft();
        else if (pending?.type === 'grade') resetDraft(pending.grade);
        else if (pending?.type === 'clear') { draft.slots = [];changed(); }
        else if (pending?.type === 'load') acceptDraft(pending.draft, { selected: pending.draft.id });
        else if (pending?.type === 'copy') acceptDraft(pending.draft, { copy: true });
        else if (pending?.type === 'import') acceptDraft(pending.draft, { baseline: true });
        else if (pending?.type === 'delete') {
          const next = records.filter(record => record.id !== pending.id);
          if (!storage) throw new Error('Хранилище браузера недоступно.');
          storage.setItem(SAVED_KEY, JSON.stringify([...next.map(record => ({ id: record.id, updatedAt: record.updatedAt, data: serializeConstructorDraft(record.draft) })), ...unreadableRecords]));
          records = next;selectedSaved = '';persistWorking();render();
        }
      }
      else if (action === 'load' || action === 'copy') {
        const record = selectedRecord();if (!record) return;
        if (dirty() && draft.slots.length) ask(action, 'Открыть выбранный шаблон? Несохранённые изменения текущего черновика будут заменены.', { draft: clone(record.draft) });
        else acceptDraft(record.draft, { copy: action === 'copy', selected: action === 'load' ? record.id : '' });
      }
      else if (action === 'delete') { const record = selectedRecord();if (record) ask('delete', 'Удалить шаблон из списка на этом устройстве? Скачанные файлы и уже выданные ссылки сохранятся.', { id: record.id }); }
      else if (action === 'save') { commit();render(); }
      else if (action === 'export') {
        const data = serializeConstructorDraft(draft);
        downloadBlob(new Blob([data], { type: 'application/json;charset=utf-8' }), safeFilename(`${draft.title || 'Работа'}_ред${draft.revision}`) + '.k1430.json');
      }
      else if (action === 'import') root.querySelector('#ctor-import')?.click();
      else if (action === 'preview') { previewOpen = true;render();root.querySelector('.ctor-preview')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
      else if (action === 'close-preview') { previewOpen = false;render(); }
      else if (action === 'reseed') { draft.seed = randomSeed();changed(); }
      else if (action === 'start' || action === 'issue') {
        const snapshot = commit({ ready: true, notify: false });render();
        await (action === 'start' ? onStart : onIssue)(snapshot, variant);
      }
    } catch (error) { notice(error.message || 'Не удалось выполнить действие.'); }
  }
  function handleInput(event) {
    const input = event.target;
    if (input.dataset.ctorField === 'title') { draft.title = input.value;changed({ repaint: false }); }
    else if (input.dataset.ctorField === 'search') { searchQuery = input.value;updateCatalogResults(); }
  }
  async function handleChange(event) {
    const input = event.target, field = input.dataset.ctorField;
    try {
      if (input.id === 'ctor-import') {
        const file = input.files?.[0];if (!file) return;
        if (file.size > MAX_FILE_BYTES) throw new Error('Файл шаблона слишком велик: максимум 128 Кбайт.');
        const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => { const reader = new view.FileReader();reader.onload = () => resolve(reader.result);reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));reader.readAsText(file); });
        const imported = parseConstructorDraft(String(text));
        if (dirty() && draft.slots.length) ask('import', 'Заменить текущий черновик импортированным шаблоном? Сохранённые шаблоны останутся в списке.', { draft: imported });
        else acceptDraft(imported, { baseline: true });
        return;
      }
      if (input.dataset.ctorPoints) { const slot = draft.slots.find(slot => slot.id === input.dataset.ctorPoints);if (slot) { const points = Number(input.value);if (!Number.isInteger(points) || points < 1 || points > 10) { input.value = slot.points;throw new Error('За одно задание можно назначить от 1 до 10 целых баллов.'); }slot.points = points;changed(); }return; }
      if (input.dataset.ctorThreshold) { draft.thresholds[input.dataset.ctorThreshold] = Number(input.value);changed({ repaint: false });return; }
      if (!field || field === 'title') return;
      if (field === 'topic') { topicFilter = input.value;updateCatalogResults(); }
      else if (field === 'level') { levelFilter = input.value;updateCatalogResults(); }
      else if (field === 'addCount') { addCount = Number(input.value); }
      else if (field === 'saved') { selectedSaved = input.value;render(); }
      else if (field === 'variant') { variant = Number(input.value);persistWorking();render(); }
      else if (field === 'answers') { showAnswers = input.checked;render(); }
      else if (field === 'grade') {
        const grade = Number(input.value);
        if (draft.slots.length) ask('grade', 'Сменить класс и очистить состав работы? Задания из разных классов не смешиваются. Сохранённые шаблоны останутся в списке.', { grade });
        else resetDraft(grade);
      }
      else if (field === 'mode') { draft.mode = input.value;if (draft.mode === 'training') draft.strict = false;changed(); }
      else if (field === 'minutes') { draft.minutes = Number(input.value);changed({ repaint: false }); }
      else if (['calculator', 'python', 'strict'].includes(field)) { draft[field] = input.checked;if (field === 'python' && summary().hasPrograms) draft.python = true;changed(); }
    } catch (error) { notice(error.message || 'Не удалось изменить настройку.'); }
  }
  function handleDragStart(event) {
    const row = event.target.closest('[data-ctor-slot]');
    if (!row || event.target.closest('button,input,select')) return;
    dragSlot = row.dataset.ctorSlot;
    event.dataTransfer?.setData('text/plain', dragSlot);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    row.classList.add('ctor-dragging');
  }
  function handleDragOver(event) { if (dragSlot && event.target.closest('[data-ctor-slot]')) event.preventDefault(); }
  function handleDrop(event) {
    const target = event.target.closest('[data-ctor-slot]')?.dataset.ctorSlot;
    if (!dragSlot || !target || target === dragSlot) return;
    event.preventDefault();
    const from = draft.slots.findIndex(slot => slot.id === dragSlot);
    if (from < 0) return;
    const [slot] = draft.slots.splice(from, 1), to = draft.slots.findIndex(item => item.id === target);
    draft.slots.splice(to < 0 ? draft.slots.length : to, 0, slot);dragSlot = null;changed();
  }
  function handleDragEnd() { dragSlot = null;root.querySelector('.ctor-dragging')?.classList.remove('ctor-dragging'); }
  const listeners = { click: handleClick, input: handleInput, change: handleChange, dragstart: handleDragStart, dragover: handleDragOver, drop: handleDrop, dragend: handleDragEnd };
  Object.entries(listeners).forEach(([name, handler]) => root.addEventListener(name, handler));
  // The native details toggle event does not bubble.
  root.addEventListener('toggle', handleSampleToggle, true);
  return { render, dispose() { if (disposed) return;disposed = true;Object.entries(listeners).forEach(([name, handler]) => root.removeEventListener(name, handler));root.removeEventListener('toggle', handleSampleToggle, true); } };
}
