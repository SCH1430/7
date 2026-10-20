/* Код 1430. Browser-local, dependency-free A4 report, PDF and PNG export. */

const A4 = { width: 794, height: 1123, margin: 48, bottom: 1050 };
const COLORS = { ink: '#192638', muted: '#536175', blue: '#3159df', line: '#d8dee7', soft: '#f2f5f9', white: '#ffffff', green: '#216346', red: '#943737' };
const STYLES = {
  body: { size: 14, lineHeight: 20, family: 'Arial, Helvetica, sans-serif', weight: 400, color: COLORS.ink },
  small: { size: 11.5, lineHeight: 16, family: 'Arial, Helvetica, sans-serif', weight: 400, color: COLORS.muted },
  title: { size: 22, lineHeight: 28, family: 'Arial, Helvetica, sans-serif', weight: 600, color: COLORS.ink },
  heading: { size: 16, lineHeight: 22, family: 'Arial, Helvetica, sans-serif', weight: 600, color: COLORS.ink },
  label: { size: 12, lineHeight: 17, family: 'Arial, Helvetica, sans-serif', weight: 600, color: COLORS.muted },
  code: { size: 12.5, lineHeight: 18, family: 'Consolas, "Liberation Mono", monospace', weight: 400, color: COLORS.ink },
};
const encoder = new TextEncoder();
const text = value => value == null ? '' : String(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const num = value => finite(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const font = style => `${style.weight || 400} ${style.size}px ${style.family}`;

function dateTime(value, timeOnly = false) {
  if (value == null || value === '') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return text(value);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    ...(timeOnly ? {} : { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date);
}

function duration(seconds) {
  const total = Math.max(0, Math.round(finite(seconds)));
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), rest = total % 60;
  return `${hours ? `${hours} ч ` : ''}${minutes} мин ${String(rest).padStart(2, '0')} с`;
}

function defaultMeasure(value, style) {
  return [...value].reduce((width, char) => width + style.size * (/\s/.test(char) ? .3 : /[il1.,:;!|]/.test(char) ? .3 : /[MWЖШЩЮФ]/.test(char) ? .85 : .58), 0);
}

function cutLine(value, maxWidth, style, measure) {
  if (measure(value, style) <= maxWidth) return [value, ''];
  const chars = Array.from(value);
  let low = 1, high = chars.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, middle).join(''), style) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return [chars.slice(0, low).join(''), chars.slice(low).join('')];
}

function wrap(value, width, style, measure, preserve = false) {
  const lines = [];
  for (const original of text(value).replace(/\r\n?/g, '\n').split('\n')) {
    let remaining = preserve ? original.replace(/\t/g, '    ') : original.trim().replace(/\s+/g, ' ');
    if (!remaining) { lines.push(''); continue; }
    while (remaining) {
      let [part, rest] = cutLine(remaining, width, style, measure);
      if (!preserve && rest) {
        const lastSpace = part.lastIndexOf(' ');
        if (lastSpace > part.length / 3) { rest = part.slice(lastSpace + 1) + rest; part = part.slice(0, lastSpace); }
      }
      lines.push(part);
      remaining = preserve ? rest : rest.trimStart();
    }
  }
  return lines;
}

function answerLabel(question) {
  const answer = question.studentAnswer;
  if (answer == null || text(answer).trim() === '') return 'Ответ не указан';
  if (Array.isArray(answer)) return answer.map(item => text(item)).join(', ');
  const option = question.options?.find(item => text(item.value) === text(answer));
  return option ? text(option.label) : text(answer);
}

function eventSummary(report) {
  const events = Array.isArray(report.events) ? report.events : [];
  const starts = events.filter(event => ['hidden', 'visibility_hidden', 'leave', 'away', 'page-hidden', 'visibility-hidden'].includes(event.type));
  // A canonical duration is emitted at return. Prefer those to avoid counting both ends twice.
  const returns = events.filter(event => ['visible', 'visibility_visible', 'return', 'back', 'page-visible', 'visibility-visible'].includes(event.type) && Number.isFinite(Number(event.durationMs)));
  const durations = returns.length ? returns : events.filter(event => Number.isFinite(Number(event.durationMs)) && finite(event.durationMs) > 0);
  return {
    count: report.hiddenCount != null ? finite(report.hiddenCount) : starts.length || durations.length,
    totalMs: report.hiddenTotalMs != null ? finite(report.hiddenTotalMs) : durations.reduce((sum, event) => sum + Math.max(0, finite(event.durationMs)), 0),
  };
}

const EVENT_NAMES = {
  hidden: 'Страница скрыта', visible: 'Возврат на страницу', leave: 'Страница скрыта', return: 'Возврат на страницу',
  'visibility-hidden': 'Страница скрыта', 'visibility-visible': 'Возврат на страницу',
  fullscreen_exit: 'Выход из полноэкранного режима', 'fullscreen-exit': 'Выход из полноэкранного режима',
  fullscreen_enter: 'Полноэкранный режим включён', reload: 'Восстановление после перезагрузки', restore: 'Попытка восстановлена',
  start: 'Начало работы', finish: 'Завершение работы', timeout: 'Время работы истекло', warning: 'Предупреждение',
};

/** Pure layout: useful for tests and alternative renderers. All coordinates are CSS pixels. */
export function buildReportLayout(report = {}, measureText = defaultMeasure) {
  const pages = [];
  let page, y = 0;
  const left = A4.margin, width = A4.width - left * 2;
  const add = command => page.commands.push(command);
  const drawText = (value, x, top, style, extra = {}) => add({ type: 'text', text: text(value), x, y: top, style: { ...style }, ...extra });
  const line = (x1, y1, x2, y2, color = COLORS.line, lineWidth = 1) => add({ type: 'line', x1, y1, x2, y2, color, lineWidth });
  const newPage = () => {
    page = { number: pages.length + 1, commands: [] }; pages.push(page);
    add({ type: 'rect', x: 0, y: 0, width: A4.width, height: A4.height, fill: COLORS.white });
    drawText(report.appName || 'Код 1430', left, 27, { ...STYLES.heading, color: COLORS.blue });
    const rightTitle = `Информатика · Школа №1430`;
    drawText(rightTitle, A4.width - left, 31, STYLES.small, { align: 'right' });
    line(left, 58, A4.width - left, 58);
    y = 76;
  };
  const ensure = amount => { if (y + amount > A4.bottom) newPage(); };
  const gap = (amount = 10) => { y += amount; };
  const paragraph = (value, style = STYLES.body, options = {}) => {
    const x = options.x ?? left, maxWidth = options.width ?? width;
    const rows = wrap(value, maxWidth, style, measureText, options.preserve);
    for (const row of rows) { ensure(style.lineHeight); drawText(row, x, y, style); y += style.lineHeight; }
    return rows.length;
  };
  const label = value => { ensure(40); paragraph(value, STYLES.label); gap(4); };
  const codeBlock = (value, title, lineNumbers = false) => {
    const sourceLines = text(value).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    const gutter = lineNumbers ? 36 : 0;
    const contentWidth = width - 24 - gutter;
    const wrappedLines = sourceLines.map(source => wrap(source, contentWidth, STYLES.code, measureText, true));
    const needsNote = wrappedLines.some(rows => rows.length > 1);
    const totalRows = wrappedLines.reduce((count, rows) => count + rows.length, 0);
    const blockHeight = STYLES.label.lineHeight + 4 + totalRows * STYLES.code.lineHeight + 11 + (needsNote && lineNumbers ? 20 : 0);
    // Keep a block together when it can fit on a page; split genuinely long code only.
    ensure(blockHeight <= A4.bottom - 76 ? blockHeight : STYLES.label.lineHeight + 4 + 2 * STYLES.code.lineHeight + 4);
    label(title);
    for (let index = 0; index < wrappedLines.length; index++) {
      const rows = wrappedLines[index];
      for (let row = 0; row < rows.length; row++) {
        if (y + STYLES.code.lineHeight + 4 > A4.bottom) { newPage(); label(`${title} — продолжение`); }
        add({ type: 'rect', x: left, y: y - 1, width, height: STYLES.code.lineHeight + 2, fill: COLORS.soft });
        if (lineNumbers) drawText(row ? '↳' : String(index + 1), left + 30, y, { ...STYLES.code, color: COLORS.muted }, { align: 'right' });
        drawText(rows[row], left + 12 + gutter, y, STYLES.code);
        y += STYLES.code.lineHeight;
      }
    }
    gap(7);
    if (needsNote && lineNumbers) { paragraph('↳ — визуальный перенос одной строки кода.', STYLES.small); gap(4); }
  };
  newPage();

  paragraph(report.mode === 'training' ? 'Тренировочная работа' : 'Контрольная работа', STYLES.title);
  gap(13);
  if (report.workTitle) { paragraph(`Работа: ${report.workTitle}`, STYLES.heading); gap(8); }
  paragraph(`Ученик: ${report.studentName || 'Не указано'}`);
  paragraph(`Класс: ${report.schoolClass || report.grade || '—'} · Вариант: ${report.variant ?? '—'}`);
  const seriesId = text(report.seriesId).trim();
  if (seriesId && !text(report.variant).toLocaleLowerCase('ru-RU').includes(seriesId.toLocaleLowerCase('ru-RU'))) paragraph(`Набор вариантов: ${seriesId}`, STYLES.small);
  paragraph(`Тема: ${report.topicTitle || 'Итоговая работа по информатике'}`);
  paragraph(`Профиль: ${report.profileTitle || '—'}`);
  if (report.difficultyTitle) paragraph(`Сложность работы: ${report.difficultyTitle}`);
  const constructorDetails = [];
  if (text(report.constructorWorkId).trim()) constructorDetails.push(`Код созданной работы: ${report.constructorWorkId}`);
  if (text(report.constructorRevision).trim()) constructorDetails.push(`Редакция: ${report.constructorRevision}`);
  if (constructorDetails.length) paragraph(constructorDetails.join(' · '), STYLES.small);
  if (report.sourceVariant || report.sourceAttemptId) {
    gap(8);
    if (report.sourceVariant) paragraph(`Тренировка ошибок · исходный вариант: ${report.sourceVariant}`, STYLES.small);
    else paragraph('Тренировка ошибок по предыдущей работе', STYLES.small);
    if (report.sourceAttemptId) paragraph(`Исходная попытка: ${report.sourceAttemptId}`, STYLES.small);
  }
  gap(10);
  paragraph(`Начало: ${dateTime(report.startedAt)} МСК`, STYLES.small);
  paragraph(`Завершение: ${dateTime(report.finishedAt)} МСК`, STYLES.small);
  paragraph(`Время выполнения: ${duration(report.elapsedSeconds)}`, STYLES.small);
  const allowed = [report.tools?.calculator ? 'калькулятор' : '', report.tools?.python ? 'Python' : ''].filter(Boolean);
  paragraph(`Разрешённые инструменты: ${allowed.join(', ') || 'не предусмотрены'}.`, STYLES.small);
  if (report.policySummary) paragraph(`Правила: ${text(report.policySummary)}`, STYLES.small);
  if (text(report.gradingScale).trim()) paragraph(`Шкала оценивания: ${report.gradingScale}`, STYLES.small);
  gap(16);
  const pending = finite(report.pending) > 0;
  const summary = `${pending ? 'Предварительный результат' : 'Результат'}: ${num(report.score)} из ${num(report.maxScore)} баллов (${num(report.percent)}%).  Оценка: ${pending ? 'не выставлена' : report.mark ?? '—'}.`;
  const summaryRows = wrap(summary, width - 24, STYLES.heading, measureText);
  ensure(summaryRows.length * STYLES.heading.lineHeight + 26);
  add({ type: 'rect', x: left, y: y - 8, width, height: summaryRows.length * STYLES.heading.lineHeight + 20, fill: COLORS.soft });
  paragraph(summary, STYLES.heading, { x: left + 12, width: width - 24 });
  gap(22);
  if (!pending && [2,3,4,5].includes(Number(report.mark)) && report.motivation?.quote) {
    paragraph(`«${report.motivation.quote}»`,STYLES.heading);
    if (report.motivation.next) paragraph(report.motivation.next,STYLES.body);
    if (report.motivation.signature) paragraph(report.motivation.signature,STYLES.small);
    gap(14);
  }
  if (pending) { paragraph('Проверка программ не завершена. Баллы предварительные; оценка не выставлена.', STYLES.body); gap(12); }
  if (report.finishReason) { paragraph(`Причина завершения: ${report.finishReason}`, STYLES.small); gap(12); }

  const questions = Array.isArray(report.questions) ? report.questions : [];
  questions.forEach((question, index) => {
    ensure(question.difficultyTitle ? 116 : 96);
    line(left, y, A4.width - left, y); gap(13);
    const title = `${index + 1}. ${question.title || 'Задание'}`;
    const status = question.correct === true ? 'Верно' : question.correct === false ? (finite(question.score) > 0 ? 'Частично верно' : 'Неверно') : 'Не проверено';
    const scoreLabel = `${num(question.score)} / ${num(question.points)}`;
    const headingLines = wrap(title, width - 112, STYLES.heading, measureText);
    drawText(scoreLabel, A4.width - left, y + 2, STYLES.label, { align: 'right' });
    for (const row of headingLines) { ensure(STYLES.heading.lineHeight); drawText(row, left, y, STYLES.heading); y += STYLES.heading.lineHeight; }
    gap(8);
    if (question.difficultyTitle) { paragraph(`Сложность задания: ${question.difficultyTitle}`, STYLES.small); gap(5); }
    paragraph(question.prompt || ''); gap(9);
    if (Array.isArray(question.options)) {
      for (let optionIndex = 0; optionIndex < question.options.length; optionIndex++) {
        paragraph(`${optionIndex + 1}) ${text(question.options[optionIndex].label)}`, STYLES.body);
      }
      gap(8);
    }
    if (question.code) codeBlock(question.code, 'Код в условии', true);
    if (question.kind === 'program') {
      const program = question.programCode ?? question.studentAnswer;
      if (text(program).trim()) codeBlock(program, 'Программа ученика', true);
      else { label('Программа ученика'); paragraph('Код не введён.'); gap(7); }
      if (question.programInput != null && text(question.programInput) !== '') codeBlock(question.programInput, 'Входные данные последнего запуска');
      if (question.programOutput != null) codeBlock(text(question.programOutput) || '(пустой вывод)', 'Результат последнего запуска');
      if (question.programOutputTruncated) { paragraph('Вывод сокращён при выполнении программы: достигнут лимит консоли.', STYLES.small); gap(8); }
      if (question.programError) { label('Ошибка последнего запуска'); paragraph(question.programError, { ...STYLES.body, color: COLORS.red }); gap(8); }
    } else {
      label('Ответ ученика'); paragraph(answerLabel(question)); gap(8);
    }
    paragraph(`${status} · ${scoreLabel} баллов`, { ...STYLES.label, color: question.correct === true ? COLORS.green : question.correct === false ? COLORS.red : COLORS.muted });
    if (report.includeSolutions && !pending && [2,3,4,5].includes(Number(report.mark))) {
      gap(9); label('Разбор после выполнения');
      if (Array.isArray(question.solutionSteps) && question.solutionSteps.length) question.solutionSteps.forEach((step,index)=>paragraph(`${index+1}. ${text(step)}`,STYLES.body));
      else if (question.explanation) paragraph(question.explanation, STYLES.body);
      if (question.kind !== 'program' && question.answer != null) paragraph(`Правильный ответ: ${answerLabel({ ...question, studentAnswer: question.answer })}`);
      if (question.kind === 'program' && question.answer) codeBlock(question.answer,'Один из правильных вариантов программы',true);
    }
    gap(16);
  });

  ensure(100);
  paragraph('Соблюдение режима', STYLES.heading); gap(9);
  const events = Array.isArray(report.events) ? report.events : [];
  const visibility = eventSummary(report);
  paragraph(`Зафиксировано скрытий страницы: ${visibility.count}. Время отсутствия: ${duration(visibility.totalMs / 1000)}.`);
  paragraph('Эти сведения отражаются отдельно от оценки за задания. Журнал хранится локально на устройстве ученика.', STYLES.small); gap(10);
  if (!events.length) paragraph(report.mode === 'training' ? 'В тренировочном режиме журнал контроля не ведётся.' : 'События не зафиксированы.', STYLES.small);
  else {
    for (const event of events) {
      const title = event.label || EVENT_NAMES[event.type] || text(event.type) || 'Событие';
      const timing = event.durationMs != null ? ` · ${duration(finite(event.durationMs) / 1000)}` : '';
      paragraph(`${dateTime(event.at, true)} — ${title}${timing}`, STYLES.small);
    }
  }
  gap(12);
  paragraph('Работа сформирована в «Код 1430» для последующего прикрепления в электронный дневник.', STYLES.small);

  pages.forEach((item, index) => {
    item.commands.push({ type: 'line', x1: left, y1: 1070, x2: A4.width - left, y2: 1070, color: COLORS.line, lineWidth: 1 });
    const id = `Попытка: ${report.attemptId || '—'}`;
    const idRows = wrap(id, width - 100, STYLES.small, measureText);
    item.commands.push({ type: 'text', text: idRows[0] + (idRows.length > 1 ? '…' : ''), x: left, y: 1082, style: STYLES.small });
    item.commands.push({ type: 'text', text: `${index + 1} / ${pages.length}`, x: A4.width - left, y: 1082, style: STYLES.small, align: 'right' });
  });
  return { width: A4.width, height: A4.height, pages };
}

/** Returns canvases suitable for previews, PNGs, and createPdf(). */
export async function renderReportPages(report, { scale = 1.5 } = {}) {
  if (typeof document === 'undefined') throw new Error('Для создания страниц нужен браузер с Canvas.');
  if (document.fonts?.ready) await document.fonts.ready;
  const scratch = document.createElement('canvas');
  const measuringContext = scratch.getContext('2d');
  if (!measuringContext) throw new Error('Браузер не поддерживает Canvas.');
  const layout = buildReportLayout(report, (value, style) => { measuringContext.font = font(style); return measuringContext.measureText(value).width; });
  const factor = Math.max(1, Math.min(3, finite(scale, 1.5)));
  return layout.pages.map(page => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.width * factor); canvas.height = Math.round(layout.height * factor);
    const ctx = canvas.getContext('2d');
    ctx.scale(factor, factor); ctx.textBaseline = 'top';
    for (const command of page.commands) {
      if (command.type === 'rect') { ctx.fillStyle = command.fill; ctx.fillRect(command.x, command.y, command.width, command.height); }
      else if (command.type === 'line') { ctx.strokeStyle = command.color; ctx.lineWidth = command.lineWidth; ctx.beginPath(); ctx.moveTo(command.x1, command.y1); ctx.lineTo(command.x2, command.y2); ctx.stroke(); }
      else { ctx.font = font(command.style); ctx.fillStyle = command.style.color; ctx.textAlign = command.align || 'left'; ctx.fillText(command.text, command.x, command.y); }
    }
    return { canvas, pageNumber: page.number, pageCount: layout.pages.length };
  });
}

function dataUrlBytes(url) {
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).includes(';base64')) throw new Error('Неверный формат изображения страницы.');
  const binary = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** A minimal standard PDF writer. Raster pages preserve Cyrillic without font downloads. */
export function createPdf(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Нет страниц для создания PDF.');
  const chunks = [], offsets = [0];
  let length = 0;
  const append = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
  const object = (id, content) => { offsets[id] = length; append(`${id} 0 obj\n`); append(content); append('\nendobj\n'); };
  append(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, '<< /Title (Kod 1430 - completed work) /Producer (Kod 1430 browser exporter) >>');
  pages.forEach((page, index) => {
    const canvas = page.canvas || page;
    const image = dataUrlBytes(canvas.toDataURL('image/jpeg', .94));
    const pageId = 4 + index * 3, imageId = pageId + 1, contentId = pageId + 2;
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    offsets[imageId] = length;
    append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
    append(image); append('\nendstream\nendobj\n');
    const content = 'q\n595.276 0 0 841.89 0 0 cm\n/Im1 Do\nQ\n';
    object(contentId, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  });
  const xref = length, count = 4 + pages.length * 3;
  append(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export function safeFilename(value) {
  let result = text(value || 'rabota').normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/\s+/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 120);
  if (!result) result = 'rabota';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result)) result = `file_${result}`;
  return result;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = safeFilename(filename); link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function pngBlob(page) {
  const canvas = page.canvas || page;
  if (typeof canvas.toBlob === 'function') return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
  return new Blob([dataUrlBytes(canvas.toDataURL('image/png'))], { type: 'image/png' });
}

export async function downloadPngPage(page, filename) {
  downloadBlob(await pngBlob(page), filename);
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

/** One download for all PNG pages; standard uncompressed ZIP, UTF-8 filenames. */
export async function createPngZip(pages, prefix = 'Код1430_работа') {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Нет страниц для создания архива.');
  const local = [], central = [];
  let offset = 0, directorySize = 0;
  const base = safeFilename(prefix).replace(/\.(png|zip)$/i, '');
  for (let index = 0; index < pages.length; index++) {
    const data = new Uint8Array(await (await pngBlob(pages[index])).arrayBuffer());
    const name = encoder.encode(`${base}_${String(index + 1).padStart(2, '0')}.png`), checksum = crc32(data);
    const header = new Uint8Array(30), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(12, 33, true); h.setUint32(14, checksum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    const dir = new Uint8Array(46), d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint16(14, 33, true);
    d.setUint32(16, checksum, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
    local.push(header, name, data); central.push(dir, name);
    offset += header.length + name.length + data.length; directorySize += dir.length + name.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, pages.length, true); e.setUint16(10, pages.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}
