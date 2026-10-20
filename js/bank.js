/* Авторские тренировочные задания. Не являются официальными КИМ ФИПИ. */
import { registerGrade7 } from './bank-grade7.js';
import { registerGrade8 } from './bank-grade8.js';
import { registerGrade9 } from './bank-grade9.js';
import { registerGrade10 } from './bank-grade10.js';
import { registerGrade11 } from './bank-grade11.js';
import { registerMoreGrade7 } from './bank-more-grade7.js';
import { registerMoreGrade8 } from './bank-more-grade8.js';
import { registerMoreGrade9 } from './bank-more-grade9.js';
import { registerMoreGrade10 } from './bank-more-grade10.js';
import { registerMoreGrade11 } from './bank-more-grade11.js';

export const BANK_VERSION = '2026.10.20-4';
export const LEGACY_BANK_VERSION = '2026.10.20-2';
export const PREVIOUS_BANK_VERSION = '2026.10.20-3';
export const SUPPORTED_BANK_VERSIONS = Object.freeze([LEGACY_BANK_VERSION, PREVIOUS_BANK_VERSION, BANK_VERSION]);

const catalog = [];
const templates = new Map();
const titleMap = new Map();

function topic(grade, id, title, description, entries) {
  let row = catalog.find(item => item.grade === grade);
  if (!row) { row = { grade, topics: [] }; catalog.push(row); }
  row.topics.push({ id, title, description });
  titleMap.set(id, title);
  entries.forEach(([key, label, build]) => templates.set(`${id}-${key}`, { id: `${id}-${key}`, grade, topicId: id, title: label, build }));
}

function rng(seed) {
  let state = 2166136261;
  for (const character of String(seed)) { state ^= character.charCodeAt(0); state = Math.imul(state, 16777619); }
  const next = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = values => values[next.int(0, values.length - 1)];
  next.array = (count, lo, hi) => Array.from({ length: count }, () => next.int(lo, hi));
  return next;
}

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = random.int(0, i); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const numeric = (prompt, answer, explanation, extra = {}) => ({ kind: 'number', prompt, answer: String(answer), explanation, points: 1, ...extra });
const textual = (prompt, answer, explanation, extra = {}) => ({ kind: 'text', prompt, answer: String(answer), explanation, points: 1, ...extra });
function choice(prompt, right, wrong, explanation, random) {
  const labels = shuffle([String(right), ...wrong.map(String)], random);
  const options = labels.map((label, index) => ({ value: String(index), label }));
  return { kind: 'choice', prompt, options, answer: String(labels.indexOf(String(right))), explanation, points: 1 };
}
function program(prompt, solution, tests, starterCode = '# Введите программу\n') {
  return { kind: 'program', prompt: `${prompt}\n\nПример входа:\n${tests[0].input.trim()}\nПример вывода:\n${tests[0].output.trim()}`, answer: solution, explanation: `Один из вариантов решения:\n${solution}`, tests, starterCode, points: 3 };
}
const sum = values => values.reduce((a, b) => a + b, 0);
const bits = count => Math.ceil(Math.log2(count));
const fact = n => n < 2 ? 1 : n * fact(n - 1);
const combinations = (n, k) => fact(n) / fact(k) / fact(n - k);
const table = rows => rows.map(row => row.join(' | ')).join('\n');
const codeOutput = (code, answer, explanation) => numeric('Какое число выведет программа Python?', answer, explanation, { code });

topic(7, 'g7-information', 'Информация и её объём', 'Биты, байты, размеры сообщений и скорость передачи.', [
  ['bits', 'Биты и байты', r => { const n = r.int(11, 250); return numeric(`Сообщение занимает ${n * 8} бит. Сколько это байт?`, n, `В одном байте 8 бит: ${n * 8} ÷ 8 = ${n}.`); }],
  ['kbytes', 'Килобайты', r => { const n = r.int(2, 48); return numeric(`Файл занимает ${n} Кбайт. Найдите его размер в байтах. Здесь 1 Кбайт = 1024 байта.`, n * 1024, `${n} × 1024 = ${n * 1024} байт.`); }],
  ['message', 'Размер сообщения', r => { const n = r.int(25, 220), b = r.pick([8, 16, 32]); return numeric(`В сообщении ${n} символов. Каждый символ занимает ${b} бит. Сколько байт занимает сообщение без служебных данных?`, n * b / 8, `${n} × ${b} ÷ 8 = ${n * b / 8} байт.`); }],
  ['speed', 'Передача данных', r => { const speed = r.int(12, 90), time = r.int(4, 30); return numeric(`За секунду передаётся ${speed} байт. Сколько байт будет передано за ${time} с при постоянной скорости?`, speed * time, `Объём = скорость × время: ${speed} × ${time} = ${speed * time}.`); }],
  ['compare', 'Сравнение объёмов', r => { const n = r.int(2, 15); const right = `${n + 1} Кбайт`; return choice('Какой из перечисленных объёмов самый большой? Здесь 1 Кбайт = 1024 байта, 1 байт = 8 бит.', right, [`${n * 1024} байт`, `${n * 8 * 1024} бит`, `${n} Кбайт`], `Три меньших объёма равны ${n} Кбайт. Наибольший — ${right}.`, r); }]
]);

topic(7, 'g7-encoding', 'Кодирование', 'Равномерные коды, алфавиты и простые изображения.', [
  ['alphabet', 'Возможности двоичного кода', r => { const k = r.int(2, 8); return numeric(`Для каждого символа выделено ${k} двоичных разряда. Сколько разных символов можно закодировать?`, 2 ** k, `Каждый разряд имеет два значения. Всего 2^${k} = ${2 ** k} кодов.`); }],
  ['length', 'Длина кодовой записи', r => { const n = r.int(5, 25), k = r.int(2, 6); return numeric(`Код каждого символа содержит ${k} бита. Сообщение состоит из ${n} символов. Сколько бит в его кодовой записи?`, n * k, `${n} × ${k} = ${n * k} бит.`); }],
  ['decode', 'Чтение равномерного кода', r => { const letters = ['А', 'Б', 'В', 'Г']; const word = r.array(5, 0, 3).map(i => letters[i]).join(''); const encoded = [...word].map(c => letters.indexOf(c).toString(2).padStart(2, '0')).join(''); return textual(`Используется код: А — 00, Б — 01, В — 10, Г — 11. Расшифруйте запись ${encoded}. Введите русские буквы подряд.`, word, `Разбиваем запись на пары: ${[...word].map(c => letters.indexOf(c).toString(2).padStart(2, '0')).join(' ')}. Получается ${word}.`); }],
  ['pixels', 'Размер изображения', r => { const w = r.int(12, 40), h = r.int(12, 40); return numeric(`Изображение имеет ${w} × ${h} пикселей. Один пиксель занимает 1 байт. Сжатия и служебных данных нет. Найдите объём в байтах.`, w * h, `${w} × ${h} × 1 = ${w * h} байт.`); }],
  ['codeword', 'Кодирование слова', r => { const text = r.pick(['МАМА', 'ЛАМА', 'МАЛА', 'АМАЛ', 'ЛАМАМА']), codeA = r.pick(['00', '11']), rest = codeA === '00' ? ['01', '10'] : ['00', '01']; const codes = { А: codeA, М: rest[0], Л: rest[1] }; const answer = [...text].map(c => codes[c]).join(''); return textual(`Закодируйте слово ${text}. Таблица: А — ${codes.А}, М — ${codes.М}, Л — ${codes.Л}. Введите только нули и единицы.`, answer, `Соединяем коды по порядку: ${[...text].map(c => codes[c]).join(' ')}.`); }]
]);

topic(7, 'g7-files', 'Файлы и папки', 'Имена файлов, пути, свободное место и размеры данных.', [
  ['extension', 'Расширение файла', r => { const n = r.int(1, 999); return choice(`У файла diagram_${n}.png какое расширение?`, 'png', ['diagram', String(n), 'diagram_' + n], 'Расширение — часть имени после последней точки: png.', r); }],
  ['space', 'Свободное место', r => { const capacity = r.int(50, 120), a = r.int(5, 19), b = r.int(5, 19); return numeric(`На носителе было ${capacity} Мбайт свободного места. Записали два файла размером ${a} и ${b} Мбайт. Сколько Мбайт осталось?`, capacity - a - b, `${capacity} − ${a} − ${b} = ${capacity - a - b} Мбайт.`); }],
  ['copies', 'Размер набора файлов', r => { const n = r.int(3, 18), size = r.int(12, 80); return numeric(`В папке ${n} файлов, каждый размером ${size} Кбайт. Сколько Кбайт занимает их содержимое? Размером самой папки пренебречь.`, n * size, `${n} × ${size} = ${n * size} Кбайт.`); }],
  ['path', 'Полный путь', r => { const lesson = r.int(1, 40), task = r.int(1, 20); return textual(`В папке /school лежит папка lesson${lesson}. Внутри неё находится файл task${task}.txt. Запишите полный путь к файлу с символом / в качестве разделителя.`, `/school/lesson${lesson}/task${task}.txt`, `К родительскому пути добавляем папку и имя: /school/lesson${lesson}/task${task}.txt.`); }],
  ['fit', 'Сколько файлов поместится', r => { const size = r.int(5, 25), n = r.int(3, 30), extra = r.int(1, size - 1); return numeric(`Свободно ${size * n + extra} Кбайт. Каждый новый файл занимает ${size} Кбайт. Какое наибольшее количество целых файлов можно записать?`, n, `Берём целую часть ${size * n + extra} ÷ ${size}: ${n}. Останется ${extra} Кбайт.`); }]
]);

topic(7, 'g7-algorithms', 'Первые алгоритмы', 'Последовательность команд, повторение и условие.', [
  ['linear', 'Последовательные действия', r => { const a = r.int(2, 30), b = r.int(2, 7), c = r.int(1, 15); return numeric(`Исполнитель получил число ${a}. Сначала он умножил его на ${b}, затем прибавил ${c}. Какое число получилось?`, a * b + c, `Выполняем команды по порядку: ${a} × ${b} + ${c} = ${a * b + c}.`); }],
  ['repeat', 'Повторение команды', r => { const start = r.int(0, 30), step = r.int(2, 9), n = r.int(3, 12); return numeric(`На экране число ${start}. Исполнитель ${n} раз выполняет команду «прибавить ${step}». Какое число будет на экране?`, start + n * step, `${start} + ${n} × ${step} = ${start + n * step}.`); }],
  ['branch', 'Условие', r => { const x = r.int(2, 40), edge = r.int(10, 30); const answer = x > edge ? x - 5 : x + 5; return numeric(`Дано x = ${x}. Если x > ${edge}, уменьшить x на 5, иначе увеличить на 5. Чему станет равно x?`, answer, `Условие ${x} > ${edge} ${x > edge ? 'истинно' : 'ложно'}, поэтому получаем ${answer}.`); }],
  ['reverse', 'Обратный ход', r => { const x = r.int(3, 35), a = r.int(2, 8), b = r.int(2, 15); return numeric(`Неизвестное число умножили на ${a}, затем прибавили ${b} и получили ${x * a + b}. Найдите исходное число.`, x, `Обратные действия: (${x * a + b} − ${b}) ÷ ${a} = ${x}.`); }],
  ['line', 'Перемещение исполнителя', r => { const start = r.int(-10, 10), right = r.int(3, 15), left = r.int(2, 12); return numeric(`Исполнитель стоит в точке ${start} числовой прямой. Он переместился на ${right} единиц вправо, затем на ${left} единиц влево. Укажите конечную координату.`, start + right - left, `${start} + ${right} − ${left} = ${start + right - left}.`); }]
]);

topic(8, 'g8-bases', 'Системы счисления', 'Перевод между двоичной, восьмеричной и шестнадцатеричной системами.', [
  ['binary', 'Из двоичной в десятичную', r => { const n = r.int(17, 250); return numeric(`Переведите число ${n.toString(2)}₂ в десятичную систему.`, n, `Сумма весов разрядов с единицами равна ${n}.`); }],
  ['tobinary', 'Двоичная запись', r => { const n = r.int(17, 250); return textual(`Запишите десятичное число ${n} в двоичной системе без ведущих нулей и без указания основания.`, n.toString(2), `${n}₁₀ = ${n.toString(2)}₂.`); }],
  ['octal', 'Восьмеричная система', r => { const n = r.int(65, 511); return numeric(`Переведите число ${n.toString(8)}₈ в десятичную систему.`, n, `Разряды имеют веса 1, 8, 64 и далее. Получаем ${n}.`); }],
  ['hex', 'Шестнадцатеричная система', r => { const n = r.int(32, 255); return numeric(`Переведите число ${n.toString(16).toUpperCase()}₁₆ в десятичную систему. A = 10, B = 11, C = 12, D = 13, E = 14, F = 15.`, n, `${Math.floor(n / 16)} × 16 + ${n % 16} = ${n}.`); }],
  ['addition', 'Сложение двоичных чисел', r => { const a = r.int(9, 55), b = r.int(5, 45); return textual(`Сложите ${a.toString(2)}₂ и ${b.toString(2)}₂. Ответ запишите в двоичной системе без ведущих нулей.`, (a + b).toString(2), `Это ${a} + ${b} = ${a + b}; двоичная запись суммы — ${(a + b).toString(2)}.`); }]
]);

topic(8, 'g8-logic', 'Логические выражения', 'НЕ, И, ИЛИ, сравнения и таблицы истинности.', [
  ['expression', 'И, ИЛИ, НЕ', r => { const a = r.int(0, 1), b = r.int(0, 1), c = r.int(0, 1); const result = Number((a && !b) || c); return numeric(`При A = ${a}, B = ${b}, C = ${c} найдите значение (A И НЕ B) ИЛИ C. Введите 0 или 1.`, result, `НЕ B = ${1 - b}; A И НЕ B = ${Number(a && !b)}. После ИЛИ C получается ${result}.`); }],
  ['demorgan', 'Отрицание выражения', r => { const a = r.int(3, 30), x = r.int(1, 40), b = r.int(2, 8); const result = Number(!(x > a && x % b === 0)); return numeric(`При x = ${x} найдите значение НЕ ((x > ${a}) И (x делится на ${b} без остатка)). Введите 0 или 1.`, result, `Сначала проверяем сравнение и делимость, объединяем через И и отрицаем. Ответ: ${result}.`); }],
  ['interval', 'Количество подходящих чисел', r => { const a = r.int(1, 20), width = r.int(4, 15), b = a + width; return numeric(`Сколько целых чисел x удовлетворяют условию (x > ${a}) И (x < ${b})?`, width - 1, `Подходят числа от ${a + 1} до ${b - 1} включительно: ${width - 1}.`); }],
  ['rows', 'Таблица истинности', r => { const n = r.int(2, 8); return numeric(`Сколько различных строк содержит полная таблица истинности для ${n} независимых логических переменных? Строку заголовков не считать.`, 2 ** n, `У каждой переменной два значения: 2^${n} = ${2 ** n} наборов.`); }],
  ['condition', 'Условие выбора', r => { const n = r.int(10, 80), k = r.int(2, 9), t = r.int(15, 55); return choice(`Число ${n} принимается, если оно больше ${t} ИЛИ делится на ${k} без остатка. Будет ли оно принято?`, n > t || n % k === 0 ? 'Да' : 'Нет', [n > t || n % k === 0 ? 'Нет' : 'Да'], `Сравнение: ${n > t ? 'истина' : 'ложь'}; делимость: ${n % k === 0 ? 'истина' : 'ложь'}. Для ИЛИ достаточно одного истинного условия.`, r); }]
]);

topic(8, 'g8-information', 'Объём и передача данных', 'Текст, изображения, алфавиты и сжатие.', [
  ['raster', 'Растровое изображение', r => { const w = r.pick([128, 256, 512]), h = r.pick([128, 256, 384, 512]), depth = r.pick([8, 16, 24]); return numeric(`Изображение ${w} × ${h} пикселей имеет глубину цвета ${depth} бит. Сжатия и заголовка нет. Найдите размер в Кбайт; 1 Кбайт = 1024 байта.`, w * h * depth / 8192, `${w} × ${h} × ${depth} ÷ 8 ÷ 1024 = ${w * h * depth / 8192} Кбайт.`); }],
  ['text', 'Текстовый документ', r => { const pages = r.int(2, 12), lines = r.int(15, 45), chars = r.int(30, 70), bytes = r.pick([1, 2]); return numeric(`Документ содержит ${pages} страниц, на каждой ${lines} строк по ${chars} символов. Каждый символ занимает ${bytes} байт. Переводы строк и служебные данные не учитывать. Найдите объём в байтах.`, pages * lines * chars * bytes, `${pages} × ${lines} × ${chars} × ${bytes} = ${pages * lines * chars * bytes} байт.`); }],
  ['transfer', 'Время передачи', r => { const speed = r.int(2, 12) * 1024, time = r.int(3, 25), bytes = speed * time / 8; return numeric(`Файл размером ${bytes} байт передаётся со скоростью ${speed} бит/с. Скорость постоянная, накладные расходы отсутствуют. Сколько секунд займёт передача?`, time, `${bytes} × 8 ÷ ${speed} = ${time} с.`); }],
  ['alphabet', 'Алфавит и сообщение', r => { const k = r.int(3, 7), length = r.int(15, 90); return numeric(`Алфавит содержит ${2 ** k} символов. Каждый символ кодируется одинаковым минимальным числом бит. Сколько бит занимает сообщение длиной ${length} символов?`, k * length, `Один символ — ${k} бит, поэтому ${length} × ${k} = ${length * k} бит.`); }],
  ['compression', 'Уменьшение файла', r => { const original = r.int(3, 20) * 100, percentage = r.pick([20, 25, 40, 50, 60, 75]); return numeric(`После сжатия размер файла ${original} Кбайт уменьшился на ${percentage}%. Сколько Кбайт занимает сжатый файл?`, original * (100 - percentage) / 100, `Осталось ${100 - percentage}%: ${original} × ${100 - percentage} ÷ 100 = ${original * (100 - percentage) / 100}.`); }]
]);

topic(8, 'g8-algorithms', 'Алгоритмы на Python', 'Присваивание, условия, циклы и цифры числа.', [
  ['sumloop', 'Сумма в цикле', r => { const n = r.int(4, 15), start = r.int(1, 4); return codeOutput(`s = 0\nfor i in range(${start}, ${n + start}):\n    s += i\nprint(s)`, n * (2 * start + n - 1) / 2, `Цикл складывает ${n} целых чисел от ${start} до ${n + start - 1}.`); }],
  ['digits', 'Цифры числа', r => { const n = r.int(101, 999); return codeOutput(`n = ${n}\nprint(n // 100 + n // 10 % 10 + n % 10)`, [...String(n)].reduce((s, x) => s + Number(x), 0), 'Выражения выделяют сотни, десятки и единицы; программа складывает три цифры.'); }],
  ['ceil', 'Целочисленное деление', r => { const n = r.int(15, 120), k = r.int(3, 12); return codeOutput(`n = ${n}\nk = ${k}\na = n // k\nif n % k != 0:\n    a += 1\nprint(a)`, Math.ceil(n / k), `Целое частное равно ${Math.floor(n / k)}, остаток ${n % k}. При ненулевом остатке добавляется 1.`); }],
  ['while', 'Цикл с условием', r => { const start = r.int(2, 9), step = r.int(2, 7), limit = r.int(20, 55); const count = Math.ceil((limit - start) / step); return codeOutput(`x = ${start}\nk = 0\nwhile x < ${limit}:\n    x += ${step}\n    k += 1\nprint(k)`, count, `После ${count} прибавлений x впервые становится не меньше ${limit}.`); }],
  ['branch', 'Ветвление в программе', r => { const x = r.int(-15, 25), k = r.int(2, 8); return codeOutput(`x = ${x}\nif x < 0:\n    x = -x\nelse:\n    x += ${k}\nprint(x)`, x < 0 ? -x : x + k, x < 0 ? 'Для отрицательного x меняется знак.' : `Для неотрицательного x прибавляется ${k}.`); }]
]);

topic(9, 'g9-python', 'Python: строки и списки', 'Чтение кода, срезы, арифметика и обработка коллекций.', [
  ['slice', 'Срез строки', r => { const word = r.pick(['ИНФОРМАТИКА', 'ПРОГРАММИРОВАНИЕ', 'АЛГОРИТМИЗАЦИЯ']), start = r.int(0, 3), end = r.int(6, 10); return textual('Что выведет программа Python? Введите русские буквы без кавычек.', word.slice(start, end), `Срез включает индексы ${start}…${end - 1}.`, { code: `s = "${word}"\nprint(s[${start}:${end}])` }); }],
  ['listsum', 'Сумма элементов', r => { const a = r.array(6, -9, 20); return codeOutput(`a = [${a.join(', ')}]\nprint(sum(a) - min(a))`, sum(a) - Math.min(...a), `Сумма элементов ${sum(a)}, минимальный элемент ${Math.min(...a)}. Вычитаем минимум из суммы.`); }],
  ['division', 'Остаток и частное', r => { const n = r.int(101, 999), k = r.int(3, 12); return codeOutput(`n = ${n}\nprint(n // ${k} + n % ${k})`, Math.floor(n / k) + n % k, `Целое частное ${Math.floor(n / k)}, остаток ${n % k}; их сумма ${Math.floor(n / k) + n % k}.`); }],
  ['filter', 'Подсчёт элементов', r => { const a = r.array(7, -10, 20), t = r.int(0, 10); return codeOutput(`a = [${a.join(', ')}]\nk = 0\nfor x in a:\n    if x > ${t}:\n        k += 1\nprint(k)`, a.filter(x => x > t).length, `Чисел строго больше ${t}: ${a.filter(x => x > t).length}.`); }],
  ['function', 'Функция с параметром', r => { const a = r.int(2, 8), b = r.int(1, 12), x = r.int(3, 15); return codeOutput(`def f(x):\n    return ${a} * x + ${b}\n\nprint(f(${x}) - f(${x - 1}))`, a, `При увеличении аргумента на 1 значение функции увеличивается на ${a}.`); }]
]);

topic(9, 'g9-programming', 'Напиши программу', 'Небольшие программы с вводом, циклами и функциями.', [
  ['linear', 'Вычисление выражения', r => { const k = r.int(2, 12), b = r.int(1, 25), values = [r.int(1, 30), 0, -7, 100]; const solution = `x = int(input())\nprint(${k} * x + ${b})`; return program(`На вход подаётся одно целое число x. Выведите значение ${k} * x + ${b}.`, solution, values.map(x => ({ input: `${x}\n`, output: `${k * x + b}\n` })), 'x = int(input())\n# Вычислите и выведите ответ\n'); }],
  ['maximum', 'Максимум чисел', r => { const n = r.int(3, 7), a = r.array(n, -20, 50), testArrays = [a, Array(n).fill(-5), Array.from({ length: n }, (_, i) => -i - 1), Array.from({ length: n }, (_, i) => i * 11)]; const solution = 'a = list(map(int, input().split()))\nprint(max(a))'; return program(`На вход в одной строке подаются ${n} целых чисел через пробел. Выведите наибольшее из них.`, solution, testArrays.map(a => ({ input: a.join(' ') + '\n', output: Math.max(...a) + '\n' })), 'a = list(map(int, input().split()))\n# Найдите максимум\n'); }],
  ['digitcount', 'Количество заданных цифр', r => { const d = r.int(0, 9), values = [r.int(10000, 99999), 0, Number(`${d || 1}${d}${d}`), 987654321]; const solution = `n = input().strip()\nprint(n.count("${d}"))`; return program(`На вход подаётся неотрицательное целое число без ведущих нулей (само число 0 допустимо). Выведите количество цифр ${d} в его десятичной записи.`, solution, values.map(n => ({ input: n + '\n', output: String([...String(n)].filter(c => c === String(d)).length) + '\n' })), 'n = input().strip()\n# Подсчитайте нужную цифру\n'); }],
  ['multiples', 'Сумма кратных чисел', r => { const k = r.int(2, 9), values = [r.int(20, 80), 1, k, 100]; const solution = `n = int(input())\ns = 0\nfor x in range(1, n + 1):\n    if x % ${k} == 0:\n        s += x\nprint(s)`; return program(`На вход подаётся целое n (1 ≤ n ≤ 10000). Выведите сумму чисел от 1 до n включительно, которые делятся на ${k} без остатка.`, solution, values.map(n => ({ input: n + '\n', output: String(k * Math.floor(n / k) * (Math.floor(n / k) + 1) / 2) + '\n' })), 'n = int(input())\ns = 0\n# Допишите цикл\nprint(s)\n'); }],
  ['quotient', 'Частное и остаток', r => { const k = r.int(2, 25), values = [r.int(30, 500), 0, k - 1, 2 * k]; const solution = `n = int(input())\nprint(n // ${k}, n % ${k})`; return program(`На вход подаётся неотрицательное целое n. Выведите в одной строке через пробел целую часть частного n / ${k} и остаток от деления на ${k}.`, solution, values.map(n => ({ input: n + '\n', output: `${Math.floor(n / k)} ${n % k}\n` })), 'n = int(input())\n# Выведите два значения через пробел\n'); }]
]);

topic(9, 'g9-tables', 'Электронные таблицы', 'Формулы, диапазоны, ссылки и анализ данных.', [
  ['sum', 'Сумма диапазона', r => { const a = r.array(4, 5, 80); return numeric(`В таблице записано:\n${table([['Ячейка', 'A1', 'A2', 'A3', 'A4'], ['Значение', ...a]])}\nКаков результат формулы =СУММ(A1:A4)?`, sum(a), `Складываем четыре значения: ${a.join(' + ')} = ${sum(a)}.`); }],
  ['formula', 'Вычисление по формуле', r => { const a = r.int(3, 20), b = r.int(2, 12), c = r.int(1, 15); return numeric(`Значения ячеек: A1 = ${a}, B1 = ${b}, C1 = ${c}. Найдите результат формулы =A1*B1+C1.`, a * b + c, `Умножение выполняется первым: ${a} × ${b} + ${c} = ${a * b + c}.`); }],
  ['count', 'Подсчёт по условию', r => { const a = r.array(8, 0, 30), edge = r.int(10, 20); return numeric(`В ячейках A1:A8 находятся числа ${a.join(', ')}. Сколько ячеек содержат значения не меньше ${edge}?`, a.filter(x => x >= edge).length, `Учитываем значения ≥ ${edge}: ${a.filter(x => x >= edge).join(', ') || 'таких нет'}.`); }],
  ['reference', 'Копирование формулы', r => { const row = r.int(2, 20), shift = r.int(1, 6); return textual(`В ячейке C${row} записана формула =A${row}+$B$1. Её копируют в C${row + shift}, то есть на ${shift} строк ниже в том же столбце. Запишите полученную формулу, включая знак =.`, `=A${row + shift}+$B$1`, `Относительная ссылка A${row} сдвигается на ${shift} строк. Абсолютная ссылка $B$1 не меняется.`); }],
  ['average', 'Среднее значение', r => { const center = r.int(15, 70), a = r.int(2, 10), b = r.int(3, 12); const values = [center - a, center + a, center - b, center + b]; return numeric(`В A1:A4 записаны ${values.join(', ')}. Найдите результат =СРЗНАЧ(A1:A4).`, center, `Сумма ${4 * center}, количество значений 4. Среднее ${4 * center} ÷ 4 = ${center}.`); }]
]);

topic(9, 'g9-networks', 'Сети и маршруты', 'Передача файлов, адреса и простые графы.', [
  ['transmit', 'Передача файла', r => { const speed = r.int(2, 16), time = r.int(3, 30), size = speed * time; return numeric(`Размер файла ${size} Кбайт, скорость передачи ${speed * 8} Кбит/с. Сколько секунд длится передача без накладных расходов? 1 Кбайт = 1024 байта, 1 Кбит = 1024 бита.`, time, `${size} × 8 ÷ ${speed * 8} = ${time} с.`); }],
  ['protocol', 'Адрес веб-страницы', r => { const n = r.int(1, 900); return choice(`В адресе https://school1430.example/lesson${n}/index.html какая часть обозначает протокол?`, 'https', ['school1430.example', `lesson${n}`, 'index.html'], 'Протокол указан перед ://; здесь это https.', r); }],
  ['ipv4', 'Запись IPv4', r => { const a = r.int(10, 220), b = r.int(1, 200), c = r.int(1, 200), d = r.int(1, 240); return choice('Выберите корректную по форме запись IPv4: четыре десятичных числа от 0 до 255, разделённые точками.', `${a}.${b}.${c}.${d}`, [`${a}.${b}.300.${d}`, `${a}.${b}.${c}`, `${a}.${b}.${c}.-1`], 'IPv4 в такой записи содержит ровно четыре числа; каждое от 0 до 255.', r); }],
  ['same', 'Одна подсеть', r => { const a = r.int(1, 200), b = r.int(1, 200), last = r.int(1, 100); return choice(`Компьютер имеет адрес 192.168.${a}.${last} и маску 255.255.255.0. Какой адрес принадлежит той же подсети?`, `192.168.${a}.${last + 100}`, [`192.168.${(a + 1) % 255}.5`, `192.169.${a}.5`, `193.168.${a}.${b}`], 'При маске 255.255.255.0 должны совпадать первые три октета адресов.', r); }],
  ['route', 'Кратчайший маршрут', r => { const [a, b, c, d, e] = r.array(5, 2, 18); const routes = [a + b, c + d, a + e + d, c + e + b]; return numeric(`Дороги двусторонние. Длины в км: A–B = ${a}, B–D = ${b}, A–C = ${c}, C–D = ${d}, B–C = ${e}. Других дорог нет. Найдите длину кратчайшего пути из A в D.`, Math.min(...routes), `Возможные простые пути: A–B–D (${a + b}), A–C–D (${c + d}), A–B–C–D (${a + e + d}), A–C–B–D (${c + e + b}). Берём минимум.`); }]
]);

topic(10, 'g10-logic', 'Логика и множества', 'Импликация, эквивалентность и подсчёт наборов.', [
  ['implication', 'Импликация', r => { const x = r.int(1, 50), a = r.int(10, 35), k = r.int(2, 7); const left = x > a, right = x % k === 0; return numeric(`При x = ${x} вычислите (x > ${a}) → (x делится на ${k}). Импликация ложна только при истинной левой и ложной правой части. Ответ: 0 или 1.`, Number(!left || right), `Левая часть ${Number(left)}, правая ${Number(right)}. Импликация равна ${Number(!left || right)}.`); }],
  ['equivalence', 'Эквивалентность', r => { const x = r.int(2, 70), a = r.int(10, 40), b = r.int(2, 9); const left = x <= a, right = x % b === 0; return numeric(`При x = ${x} найдите значение (x ≤ ${a}) ≡ (x делится на ${b}). Эквивалентность истинна, когда значения частей совпадают. Ответ: 0 или 1.`, Number(left === right), `Значения частей: ${Number(left)} и ${Number(right)}. Они ${left === right ? 'совпадают' : 'различны'}.`); }],
  ['range', 'Логическое условие', r => { const a = r.int(5, 20), b = a + r.int(10, 30), k = r.int(2, 7); const matches = Array.from({ length: b - a + 1 }, (_, i) => i + a).filter(x => x % k === 0); return numeric(`Сколько целых x удовлетворяют условию (x ≥ ${a}) И (x ≤ ${b}) И (x делится на ${k})?`, matches.length, `Подходят: ${matches.join(', ')}. Всего ${matches.length}.`); }],
  ['union', 'Объединение множеств', r => { const common = r.int(4, 12), a = common + r.int(5, 20), b = common + r.int(5, 20); return numeric(`${a} учеников решают задачи по Python, ${b} — задачи по логике, ${common} решают задачи обоих типов. Сколько учеников решают хотя бы один из этих типов?`, a + b - common, `Сложив два количества, пересечение учли дважды. Ответ: ${a} + ${b} − ${common} = ${a + b - common}.`); }],
  ['trueRows', 'Подсчёт логических наборов', r => { const n = r.int(3, 9); return numeric(`Есть ${n} независимых логических переменных A₁, A₂, …, A${n}. Для скольких наборов истинно выражение A₁ И A₂? Значения остальных переменных произвольны.`, 2 ** (n - 2), `A₁ и A₂ фиксированы и равны 1. У остальных ${n - 2} переменных 2^${n - 2} = ${2 ** (n - 2)} наборов.`); }]
]);

topic(10, 'g10-encoding', 'Кодирование данных', 'Мощность алфавита, пароли, изображения и звук.', [
  ['alphabet', 'Минимальная длина кода', r => { const m = r.int(17, 120), n = r.int(20, 180); return numeric(`Алфавит содержит ${m} символов. Используется равномерное двоичное кодирование с минимальной длиной кода. Сколько бит занимает сообщение из ${n} символов?`, bits(m) * n, `Нужно ${bits(m)} бит на символ: 2^${bits(m) - 1} < ${m} ≤ 2^${bits(m)}. Всего ${n * bits(m)} бит.`); }],
  ['password', 'Хранение паролей', r => { const m = r.pick([20, 26, 36, 40, 62, 70]), length = r.int(5, 17), count = r.int(20, 200); const bytes = Math.ceil(length * bits(m) / 8); return numeric(`Пароль состоит из ${length} символов алфавита мощности ${m}. Символы кодируются одинаковым минимальным числом бит. На каждый пароль выделяется минимальное целое число байт. Сколько байт нужно для ${count} паролей без дополнительных данных?`, bytes * count, `На символ ${bits(m)} бит, на пароль ${length * bits(m)} бит, то есть ${bytes} целых байт. Для ${count} паролей: ${bytes * count} байт.`); }],
  ['image', 'Изображение с палитрой', r => { const w = r.int(11, 60), h = r.int(10, 50), colors = r.pick([9, 17, 33, 65, 100]); const b = bits(colors), size = Math.ceil(w * h * b / 8); return numeric(`Изображение ${w} × ${h} пикселей использует ${colors} цветов. Каждый пиксель кодируется одинаковым минимальным числом бит. Палитра и заголовок не сохраняются, строки не выравниваются; до целого байта дополняется только весь файл. Найдите размер в байтах.`, size, `${b} бит на пиксель. Всего ${w * h * b} бит; округляя число байт вверх, получаем ${size}.`); }],
  ['audio', 'Несжатая звукозапись', r => { const seconds = r.int(3, 20), rate = r.pick([8000, 16000, 24000]), depth = r.pick([8, 16, 24]), channels = r.pick([1, 2]); return numeric(`Звук записывают ${seconds} с с частотой ${rate} отсчётов/с на канал, разрядностью ${depth} бит и числом каналов ${channels}. Сжатия и служебных данных нет. Найдите размер в байтах.`, seconds * rate * depth * channels / 8, `${seconds} × ${rate} × ${depth} × ${channels} ÷ 8 = ${seconds * rate * depth * channels / 8} байт.`); }],
  ['compressTransmit', 'Сжатие и передача', r => { const original = r.int(10, 50) * 100, percent = r.pick([20, 40, 60, 80]), speed = r.pick([10, 20, 40]); return numeric(`Файл размером ${original} Кбайт сжат до ${percent}% исходного объёма и передан со скоростью ${speed} Кбайт/с. Временем сжатия и накладными расходами пренебречь. Сколько секунд заняла передача?`, original * percent / 100 / speed, `После сжатия ${original * percent / 100} Кбайт. Делим на ${speed} Кбайт/с и получаем ${original * percent / 100 / speed} с.`); }]
]);

topic(10, 'g10-algorithms', 'Алгоритмы и программы', 'Вложенные циклы, обработка строк и написание программ.', [
  ['nested', 'Вложенные циклы', r => { const n = r.int(3, 10), m = r.int(2, 8); return codeOutput(`s = 0\nfor i in range(1, ${n + 1}):\n    for j in range(${m}):\n        s += i\nprint(s)`, m * n * (n + 1) / 2, `Каждое число от 1 до ${n} добавляется ${m} раз. Сумма равна ${m} × ${n * (n + 1) / 2}.`); }],
  ['replace', 'Замена в строке', r => { const n = r.int(4, 18), replacement = r.int(1, 4); return codeOutput(`s = "1" * ${n}\ns = s.replace("11", "${'2'.repeat(replacement)}")\nprint(len(s))`, Math.floor(n / 2) * replacement + n % 2, `replace заменяет ${Math.floor(n / 2)} неперекрывающихся пар. Каждая даёт ${replacement} символов; ${n % 2 ? 'последняя единица остаётся' : 'непарных единиц нет'}.`); }],
  ['binary', 'Преобразование двоичной записи', r => { const n = r.int(10, 180), suffix = r.pick(['01', '10', '11']); return codeOutput(`n = ${n}\ns = bin(n)[2:] + "${suffix}"\nprint(int(s, 2))`, n * 4 + parseInt(suffix, 2), `Приписывание двух разрядов умножает число на 4 и прибавляет ${parseInt(suffix, 2)}.`); }],
  ['programDigits', 'Программа: сумма цифр', r => { const k = r.int(2, 9), values = [r.int(1000, 99999), 0, 123456789, 99999]; const answer = n => [...String(n)].map(Number).filter(x => x % k === 0).reduce((s, x) => s + x, 0); const code = `n = input().strip()\ns = 0\nfor digit in n:\n    x = int(digit)\n    if x % ${k} == 0:\n        s += x\nprint(s)`; return program(`На вход подаётся неотрицательное целое число без ведущих нулей (0 допустим). Выведите сумму его десятичных цифр, которые делятся на ${k}. Если таких цифр нет, выведите 0.`, code, values.map(n => ({ input: n + '\n', output: answer(n) + '\n' })), 'n = input().strip()\ns = 0\n# Обработайте цифры числа\nprint(s)\n'); }],
  ['programCount', 'Программа: фильтрация списка', r => { const edge = r.int(-5, 30), first = r.array(7, -20, 50), values = [first, [edge], [edge + 1, edge - 1, edge], [-100, -90], [100, 110, 120]]; const code = `a = list(map(int, input().split()))\nk = 0\nfor x in a:\n    if x > ${edge}:\n        k += 1\nprint(k)`; return program(`На вход в одной строке подаётся непустой список целых чисел через пробел. Выведите количество элементов строго больше ${edge}.`, code, values.map(a => ({ input: a.join(' ') + '\n', output: a.filter(x => x > edge).length + '\n' })), 'a = list(map(int, input().split()))\n# Подсчитайте элементы\n'); }]
]);

topic(10, 'g10-models', 'Модели и данные', 'Графы, деревья, таблицы и комбинаторные модели.', [
  ['graph', 'Полный граф', r => { const n = r.int(5, 25); return numeric(`В неориентированном графе ${n} вершин. Каждая пара различных вершин соединена ровно одним ребром. Петель нет. Сколько рёбер в графе?`, n * (n - 1) / 2, `Каждую пару считаем один раз: ${n} × ${n - 1} ÷ 2 = ${n * (n - 1) / 2}.`); }],
  ['choices', 'Выбор маршрута', r => { const a = r.int(2, 8), b = r.int(2, 8), c = r.int(2, 5); return numeric(`Первый этап маршрута можно пройти ${a} способами, второй — ${b}, третий — ${c}. Выборы независимы. Сколько полных маршрутов получится?`, a * b * c, `По правилу произведения: ${a} × ${b} × ${c} = ${a * b * c}.`); }],
  ['cost', 'Табличная модель', r => { const a = r.int(10, 60), b = r.int(5, 40), n = r.int(3, 12), m = r.int(4, 15); return numeric(`В таблице заказов: товар A — цена ${a} руб., количество ${n}; товар B — цена ${b} руб., количество ${m}. Скидок нет. Найдите общую стоимость в рублях.`, a * n + b * m, `${a} × ${n} + ${b} × ${m} = ${a * n + b * m} руб.`); }],
  ['tree', 'Двоичное дерево', r => { const depth = r.int(3, 10); return numeric(`Корень дерева находится на уровне 0. У каждой вершины уровней от 0 до ${depth - 1} ровно два потомка. У вершин уровня ${depth} потомков нет. Сколько листьев в дереве?`, 2 ** depth, `Количество вершин удваивается на каждом уровне; на последнем уровне 2^${depth} = ${2 ** depth} листьев.`); }],
  ['filter', 'Фильтрация таблицы', r => { const scores = r.array(6, 20, 100), classes = r.array(6, 9, 11), threshold = r.int(40, 80), target = r.pick([9, 10, 11]); const rows = [['№', 'Класс', 'Баллы'], ...scores.map((s, i) => [i + 1, classes[i], s])]; const count = scores.filter((s, i) => s >= threshold && classes[i] === target).length; return numeric(`Дана таблица:\n${table(rows)}\nСколько записей удовлетворяют условию «Класс = ${target} И Баллы ≥ ${threshold}»?`, count, `Одновременно проверяются оба условия. Подходящих записей: ${count}.`); }]
]);

topic(11, 'g11-algorithms', 'Анализ алгоритмов', 'Преобразования чисел, рекурсия, разряды и перебор.', [
  ['parity', 'Добавление бита чётности', r => { const n = r.int(20, 220), ones = [...n.toString(2)].filter(x => x === '1').length; return numeric(`Число N = ${n} записали в двоичной системе. Справа приписали 0, если количество единиц было чётным, иначе 1. Полученную запись перевели в десятичную систему. Найдите результат.`, n * 2 + ones % 2, `Двоичная запись числа ${n}: ${n.toString(2)}. Она содержит ${ones} единиц. Приписывается ${ones % 2}; результат ${n * 2 + ones % 2}.`); }],
  ['recursion', 'Рекурсивная функция', r => { const n = r.int(4, 15), c = r.int(1, 7); return codeOutput(`def f(n):\n    if n == 0:\n        return ${c}\n    return f(n - 1) + n\n\nprint(f(${n}))`, c + n * (n + 1) / 2, `Функция возвращает ${c} + 1 + 2 + … + ${n} = ${c + n * (n + 1) / 2}.`); }],
  ['baseDigits', 'Разряды в другой системе', r => { const n = r.int(100, 2000), base = r.int(3, 8); const repr = n.toString(base); return numeric(`Сколько цифр содержит запись десятичного числа ${n} в системе счисления с основанием ${base}?`, repr.length, `Запись числа: ${repr}. В ней ${repr.length} цифр.`); }],
  ['words', 'Количество кодовых слов', r => { const length = r.int(3, 7), alphabet = r.int(3, 7); return numeric(`Алфавит состоит из цифр от 0 до ${alphabet - 1}. Сколько существует строк длины ${length}, которые не начинаются с 0? Повторения цифр разрешены.`, (alphabet - 1) * alphabet ** (length - 1), `На первой позиции ${alphabet - 1} вариантов, на каждой из остальных — ${alphabet}. Итого ${alphabet - 1} × ${alphabet}^${length - 1}.`); }],
  ['search', 'Перебор подходящих чисел', r => { const low = r.int(10, 60), high = low + r.int(20, 70), k = r.int(3, 9), parity = r.pick([0, 1]); const xs = Array.from({ length: high - low + 1 }, (_, i) => i + low).filter(x => x % k === 0 && x % 2 === parity); return numeric(`Сколько целых чисел на отрезке [${low}; ${high}] делятся на ${k} без остатка и являются ${parity ? 'нечётными' : 'чётными'}?`, xs.length, `Подходящие числа: ${xs.join(', ') || 'отсутствуют'}. Их ${xs.length}.`); }]
]);

topic(11, 'g11-programming', 'Программирование и обработка данных', 'Последовательности, делимость, разряды и локальные экстремумы.', [
  ['squares', 'Сумма квадратов', r => { const k = r.int(2, 9), values = [r.int(20, 70), 1, k, 200]; const answer = n => sum(Array.from({ length: n }, (_, i) => i + 1).filter(x => x % k === 0).map(x => x * x)); const solution = `n = int(input())\ns = 0\nfor x in range(1, n + 1):\n    if x % ${k} == 0:\n        s += x * x\nprint(s)`; return program(`Дано целое n (1 ≤ n ≤ 10000). Найдите сумму квадратов всех чисел от 1 до n включительно, кратных ${k}.`, solution, values.map(n => ({ input: n + '\n', output: answer(n) + '\n' })), 'n = int(input())\n# Найдите сумму квадратов\n'); }],
  ['divisibility', 'Два условия делимости', r => { const k = r.int(2, 9); let m = r.int(2, 9); if (m === k) m = m === 9 ? 8 : m + 1; const pairs = [[r.int(1, 20), r.int(50, 150)], [1, 1], [k, k], [1, 500]]; const solve = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => i + a).filter(x => x % k === 0 && x % m !== 0).length; const solution = `a, b = map(int, input().split())\nk = 0\nfor x in range(a, b + 1):\n    if x % ${k} == 0 and x % ${m} != 0:\n        k += 1\nprint(k)`; return program(`В одной строке даны целые a и b (1 ≤ a ≤ b ≤ 100000). Выведите количество чисел на отрезке [a; b], которые делятся на ${k}, но не делятся на ${m}.`, solution, pairs.map(([a, b]) => ({ input: `${a} ${b}\n`, output: solve(a, b) + '\n' })), 'a, b = map(int, input().split())\n# Подсчитайте числа\n'); }],
  ['adjacent', 'Максимальная сумма соседей', r => { const n = r.int(4, 10), first = r.array(n, -30, 50), values = [first, [-8, -2], [-9, -4, -7], [1, 2, 3, 4], [0, 0, 0]]; const solve = a => Math.max(...a.slice(1).map((x, i) => x + a[i])); const solution = 'a = list(map(int, input().split()))\nbest = a[0] + a[1]\nfor i in range(1, len(a) - 1):\n    best = max(best, a[i] + a[i + 1])\nprint(best)'; return program('В одной строке дан список целых чисел через пробел, в нём не меньше двух элементов. Выведите максимальную сумму двух соседних элементов.', solution, values.map(a => ({ input: a.join(' ') + '\n', output: solve(a) + '\n' })), 'a = list(map(int, input().split()))\n# Найдите максимум суммы соседних элементов\n'); }],
  ['baseMax', 'Максимальная цифра', r => { const base = r.int(3, 9), values = [r.int(100, 3000), 0, base, base ** 4 - 1, 1]; const solve = n => Math.max(...[...n.toString(base)].map(Number)); const solution = `n = int(input())\nbest = 0\nwhile n > 0:\n    best = max(best, n % ${base})\n    n //= ${base}\nprint(best)`; return program(`На вход подаётся неотрицательное десятичное целое число. Выведите наибольшую цифру в записи этого числа в системе счисления с основанием ${base}. Ответ запишите десятичной цифрой. Для числа 0 ответ равен 0.`, solution, values.map(n => ({ input: n + '\n', output: solve(n) + '\n' })), 'n = int(input())\n# Используйте деление с остатком\n'); }],
  ['peaks', 'Локальные максимумы', r => { const first = r.array(r.int(5, 10), -10, 30), values = [first, [1, 2, 1], [3, 2, 1], [1, 3, 1, 4, 1], [2, 2, 2]]; const solve = a => a.slice(1, -1).filter((x, i) => x > a[i] && x > a[i + 2]).length; const solution = 'a = list(map(int, input().split()))\nk = 0\nfor i in range(1, len(a) - 1):\n    if a[i] > a[i - 1] and a[i] > a[i + 1]:\n        k += 1\nprint(k)'; return program('В одной строке дан список целых чисел через пробел (не меньше трёх элементов). Посчитайте элементы, строго большие обоих непосредственных соседей. Первый и последний элементы не учитывать.', solution, values.map(a => ({ input: a.join(' ') + '\n', output: solve(a) + '\n' })), 'a = list(map(int, input().split()))\n# Подсчитайте локальные максимумы\n'); }]
]);

topic(11, 'g11-graphs', 'Графы и пути', 'Кратчайшие пути, число маршрутов и свойства графов.', [
  ['layers', 'Пути через слои', r => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 6); return numeric(`Ориентированный граф состоит из слоёв S → A → B → C → T. В слоях A, B, C соответственно ${a}, ${b}, ${c} вершин; S и T — одиночные вершины. Между соседними слоями проведены все возможные рёбра по стрелкам. Других рёбер нет. Сколько путей из S в T?`, a * b * c, `Каждый путь выбирает по одной вершине из трёх промежуточных слоёв: ${a} × ${b} × ${c} = ${a * b * c}.`); }],
  ['shortest', 'Кратчайший направленный путь', r => { const [a, b, c, d] = r.array(4, 3, 30); return numeric(`В графе есть только рёбра S→A длиной ${a}, A→T длиной ${b}, S→B длиной ${c}, B→T длиной ${d}. Все длины в км. Найдите длину кратчайшего пути S→T.`, Math.min(a + b, c + d), `Два пути имеют длины ${a + b} и ${c + d}; минимум ${Math.min(a + b, c + d)}.`); }],
  ['steps', 'Маршруты с шагом 1 или 2', r => { const n = r.int(4, 18); const ways = [1, 1]; for (let i = 2; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2]; return numeric(`Вершины графа пронумерованы от 0 до ${n}. Из вершины i идут рёбра в i+1 и i+2, если такие вершины существуют. Сколько различных путей ведёт из 0 в ${n}?`, ways[n], `Число путей F(i) = F(i−1) + F(i−2), поскольку последний шаг имеет длину 1 или 2. F(0)=F(1)=1, F(${n})=${ways[n]}.`); }],
  ['degrees', 'Степени вершин', r => { const a = r.int(4, 12), b = r.int(3, 10); const edges = a * b; return numeric(`В неориентированном графе без петель сумма степеней всех вершин равна ${2 * edges}. Сколько в графе рёбер?`, edges, `Каждое ребро входит в степени двух концов, поэтому ${2 * edges} ÷ 2 = ${edges}.`); }],
  ['grid', 'Маршруты по сетке', r => { const a = r.int(2, 6), b = r.int(2, 6); return numeric(`По прямоугольной сетке нужно пройти из левого нижнего угла в правый верхний: ${a} шагов вправо и ${b} шагов вверх. Разрешены только шаги вправо или вверх. Сколько разных маршрутов существует?`, combinations(a + b, a), `Всего ${a + b} шагов. Выбираем ${a} позиций для шагов вправо: C(${a + b}, ${a}) = ${combinations(a + b, a)}.`); }]
]);

topic(11, 'g11-data', 'Данные и вычисления', 'Подсети, выборки, поиск и расчёт хранения.', [
  ['progression', 'Фильтрация последовательности', r => { const a = r.int(1, 12), d = r.int(2, 8), n = r.int(8, 25), threshold = r.int(a, a + n * d + 10); const result = Array.from({ length: n }, (_, i) => a + i * d).filter(x => x >= threshold).length; return numeric(`Последовательность содержит ${n} чисел: ${a}, ${a + d}, ${a + 2 * d}, … (каждое следующее на ${d} больше предыдущего). Сколько элементов не меньше ${threshold}?`, result, `Последний элемент ${a + (n - 1) * d}. Среди ${n} элементов условию ≥ ${threshold} удовлетворяют ${result}.`); }],
  ['subnet', 'Адреса узлов в подсети', r => { const prefix = r.int(23, 29); const n = 2 ** (32 - prefix) - 2; return numeric(`Для IPv4-подсети с префиксом /${prefix} сколько адресов остаётся для узлов, если один адрес отведён сети и один — широковещательной рассылке?`, n, `Для адресов узлов ${32 - prefix} бит: 2^${32 - prefix} − 2 = ${n}.`); }],
  ['searchbits', 'Количество двоичных вопросов', r => { const n = r.int(20, 500); return numeric(`Нужно однозначно определить один объект из ${n} возможных с помощью заранее подготовленного двоичного кода одинаковой длины для всех объектов. Какова минимальная длина кода в битах?`, bits(n), `Нужно минимальное k, при котором 2^k ≥ ${n}. Это k = ${bits(n)}.`); }],
  ['storage', 'Хранение записей', r => { const count = r.int(25, 200), fields = r.int(3, 12), size = r.int(2, 8), header = r.int(8, 50); return numeric(`Таблица содержит ${count} записей. В каждой ${fields} полей по ${size} байт. Общий заголовок файла занимает ${header} байт. Сжатия, выравнивания и других данных нет. Найдите размер файла в байтах.`, count * fields * size + header, `${count} × ${fields} × ${size} + ${header} = ${count * fields * size + header} байт.`); }],
  ['remainders', 'Пары с одинаковым остатком', r => { const n = r.int(8, 35), m = r.int(2, 8); const groups = Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => i).filter(x => x % m === j).length); const pairs = sum(groups.map(size => size * (size - 1) / 2)); return numeric(`Даны числа 0, 1, …, ${n - 1}. Сколько пар различных чисел имеют одинаковые остатки от деления на ${m}? Пару (a, b) и пару (b, a) считать одной.`, pairs, `Размеры групп по остаткам: ${groups.join(', ')}. В группе из k чисел k(k−1)/2 пар. Сумма равна ${pairs}.`); }]
]);

// Difficulty is relative to the selected grade and topic. Classification follows
// required operations/concepts; number magnitude does not change the level.
const levelDefinitions = {
  'g7-information': {
    basic: [['bits', 'Прямой перевод битов в байты.'], ['kbytes', 'Прямой перевод единиц объёма.'], ['speed', 'Одно действие по известной скорости.']],
    standard: [['message', 'Расчёт объёма сообщения с переводом единиц.']],
    advanced: [['compare', 'Сравнение нескольких объёмов в разных единицах.']],
  },
  'g7-encoding': {
    basic: [['length', 'Подсчёт общего числа бит по длине кода.'], ['pixels', 'Расчёт числа пикселей и объёма.']],
    standard: [['decode', 'Разбиение записи на кодовые слова и чтение таблицы.']],
    advanced: [['alphabet', 'Подсчёт всех комбинаций двоичных разрядов.'], ['codeword', 'Последовательное кодирование слова по таблице.']],
  },
  'g7-files': {
    basic: [['extension', 'Распознавание части имени файла.'], ['copies', 'Подсчёт размера одинаковых файлов.']],
    standard: [['space', 'Учёт двух изменений свободного места.'], ['path', 'Построение пути по вложенности папок.']],
    advanced: [['fit', 'Выделение целого количества файлов и остатка места.']],
  },
  'g7-algorithms': {
    basic: [['linear', 'Последовательное выполнение двух команд.'], ['repeat', 'Расчёт результата повторения одной команды.']],
    standard: [['branch', 'Выбор ветви по условию.'], ['line', 'Учёт направления и знака координаты.']],
    advanced: [['reverse', 'Восстановление исходного числа обратными действиями.']],
  },
  'g8-bases': {
    basic: [['binary', 'Чтение двоичной записи по весам разрядов.'], ['tobinary', 'Получение двоичной записи числа.']],
    standard: [['octal', 'Применение позиционного принципа в основании 8.'], ['hex', 'Чтение буквенных цифр в основании 16.']],
    advanced: [['addition', 'Арифметическое действие и запись результата в другой системе.']],
  },
  'g8-logic': {
    basic: [['rows', 'Подсчёт всех наборов независимых переменных.'], ['condition', 'Проверка простого условия ИЛИ.']],
    standard: [['interval', 'Учёт строгих границ целочисленного промежутка.'], ['expression', 'Последовательное применение НЕ, И и ИЛИ.']],
    advanced: [['demorgan', 'Отрицание составного условия со сравнением и делимостью.']],
  },
  'g8-information': {
    basic: [['text', 'Прямой расчёт количества символов и байтов.'], ['compression', 'Расчёт оставшейся доли файла.']],
    standard: [['transfer', 'Время передачи с переводом байтов в биты.'], ['alphabet', 'Выбор длины двоичного кода и объём сообщения.']],
    advanced: [['raster', 'Расчёт изображения с глубиной цвета и несколькими единицами.']],
  },
  'g8-algorithms': {
    basic: [['branch', 'Трассировка одного ветвления.']],
    standard: [['digits', 'Выделение и суммирование разрядов числа.'], ['sumloop', 'Трассировка накопления суммы в цикле.']],
    advanced: [['ceil', 'Совместная работа частного, остатка и условия.'], ['while', 'Подсчёт повторений до достижения границы.']],
  },
  'g9-python': {
    basic: [['slice', 'Чтение простого среза строки.'], ['division', 'Вычисление частного и остатка.']],
    standard: [['listsum', 'Сочетание двух операций над коллекцией.'], ['filter', 'Подсчёт элементов циклом с условием.']],
    advanced: [['function', 'Сопоставление результатов двух вызовов функции.']],
  },
  'g9-programming': {
    basic: [['linear', 'Ввод числа и вывод арифметического выражения.'], ['maximum', 'Обработка входного списка встроенной функцией.']],
    standard: [['quotient', 'Форматированный вывод двух вычисленных величин.'], ['digitcount', 'Подсчёт символов с учётом представления нуля.']],
    advanced: [['multiples', 'Накопление результата в цикле с отбором по условию.']],
  },
  'g9-tables': {
    basic: [['sum', 'Прямое применение функции суммы.'], ['formula', 'Вычисление арифметической формулы.']],
    standard: [['average', 'Применение среднего арифметического.'], ['count', 'Отбор значений с включённой границей.']],
    advanced: [['reference', 'Различение абсолютных и относительных ссылок при копировании.']],
  },
  'g9-networks': {
    basic: [['protocol', 'Распознавание части адреса страницы.'], ['ipv4', 'Проверка структуры записи адреса.']],
    standard: [['transmit', 'Согласование единиц размера и скорости.'], ['same', 'Применение маски при сравнении адресов.']],
    advanced: [['route', 'Сравнение нескольких путей графа.']],
  },
  'g10-logic': {
    basic: [['implication', 'Применение определения импликации.'], ['equivalence', 'Применение определения эквивалентности.']],
    standard: [['union', 'Исключение двойного учёта пересечения множеств.']],
    advanced: [['range', 'Подсчёт целых чисел по совокупности трёх условий.'], ['trueRows', 'Разделение фиксированных и свободных логических переменных.']],
  },
  'g10-encoding': {
    basic: [['audio', 'Применение формулы объёма несжатого звука.'], ['compressTransmit', 'Последовательный расчёт сжатия и передачи.']],
    standard: [['alphabet', 'Выбор минимальной целой длины двоичного кода.']],
    advanced: [['password', 'Два уровня округления: код символа и байты на пароль.'], ['image', 'Выбор глубины цвета и округление всего файла до байта.']],
  },
  'g10-algorithms': {
    basic: [['binary', 'Трассировка преобразования двоичной записи.']],
    standard: [['replace', 'Учёт неперекрывающихся замен и остатка строки.'], ['programCount', 'Написание программы отбора и подсчёта элементов.']],
    advanced: [['nested', 'Трассировка накопления во вложенных циклах.'], ['programDigits', 'Программа обработки цифр с условием и накоплением.']],
  },
  'g10-models': {
    basic: [['cost', 'Подсчёт стоимости по табличным данным.'], ['choices', 'Применение правила произведения.']],
    standard: [['tree', 'Перенос правила ветвления на глубину дерева.'], ['filter', 'Отбор строк таблицы по двум признакам.']],
    advanced: [['graph', 'Подсчёт неупорядоченных пар без двойного учёта рёбер.']],
  },
  'g11-algorithms': {
    basic: [['baseDigits', 'Определение длины позиционной записи.'], ['search', 'Перебор чисел по двум простым признакам.']],
    standard: [['parity', 'Преобразование записи с вычислением бита чётности.'], ['words', 'Комбинаторный подсчёт с ограничением первой позиции.']],
    advanced: [['recursion', 'Разворачивание рекурсивного определения функции.']],
  },
  'g11-programming': {
    basic: [['squares', 'Цикл с отбором и вычислением суммы квадратов.']],
    standard: [['divisibility', 'Отбор по двум условиям делимости на отрезке.'], ['baseMax', 'Обработка разрядов в произвольной системе и случай нуля.']],
    advanced: [['adjacent', 'Работа с соседними элементами и отрицательными значениями.'], ['peaks', 'Сравнение двух соседей с исключением границ списка.']],
  },
  'g11-graphs': {
    basic: [['shortest', 'Сравнение длин двух явно заданных путей.'], ['degrees', 'Применение связи степеней вершин и числа рёбер.']],
    standard: [['layers', 'Комбинаторный подсчёт путей по слоям.']],
    advanced: [['steps', 'Построение рекуррентного подсчёта маршрутов.'], ['grid', 'Подсчёт маршрутов как размещения однотипных шагов.']],
  },
  'g11-data': {
    basic: [['storage', 'Расчёт размера структурированных записей.'], ['searchbits', 'Выбор минимальной длины различающего кода.']],
    standard: [['subnet', 'Разделение сетевых и адресных битов с исключением служебных адресов.'], ['progression', 'Пороговый отбор элементов ограниченной последовательности.']],
    advanced: [['remainders', 'Группировка по остаткам и подсчёт неупорядоченных пар.']],
  },
};

export const DIFFICULTIES = Object.freeze([
  { id: 'basic', title: 'Базовый', description: 'Знакомые операции и прямое применение правил.' },
  { id: 'standard', title: 'Стандартный', description: 'Несколько связанных действий и работа с условиями.' },
  { id: 'advanced', title: 'Повышенный', description: 'Комбинирование приёмов, границы и более сложные алгоритмы.' },
  { id: 'mixed', title: 'По возрастанию', description: 'От базовых заданий к стандартным и повышенным.' },
].map(Object.freeze));
const levelOrder = ['basic', 'standard', 'advanced'];
for (const [topicId, levels] of Object.entries(levelDefinitions)) {
  for (const [difficulty, entries] of Object.entries(levels)) {
    for (const [key, reason] of entries) {
      const template = templates.get(`${topicId}-${key}`);
      if (!template || template.difficulty) throw new Error(`Ошибка классификации шаблона: ${topicId}-${key}`);
      Object.assign(template, { difficulty, difficultyReason: reason });
    }
  }
}
if ([...templates.values()].some(template => !template.difficulty)) throw new Error('У задания не задан уровень сложности.');

// The legacy set is captured before extensions so issued v1.1/v1.2 work links
// keep the exact old pool, random stream, data and answer keys.
const legacyTemplateIds = new Set(templates.keys());
export function isTemplateAvailable(templateId, bankVersion = BANK_VERSION) {
  return SUPPORTED_BANK_VERSIONS.includes(bankVersion) && templates.has(templateId)
    && (bankVersion !== LEGACY_BANK_VERSION || legacyTemplateIds.has(templateId))
    && (bankVersion !== PREVIOUS_BANK_VERSION || previousTemplateIds.has(templateId));
}
function registrationApi(grade) {
  return Object.freeze({ numeric, textual, choice, program, sum, bits, fact, combinations, table, codeOutput,
    add(topicId, key, title, difficulty, difficultyReason, build) {
      const row = catalog.find(row => row.grade === grade);
      if (!row?.topics.some(topic => topic.id === topicId)) throw new Error(`Неизвестная тема расширения: ${topicId}`);
      const id = `${topicId}-${key}`;
      if (templates.has(id)) throw new Error(`Повтор идентификатора шаблона: ${id}`);
      if (!['basic', 'standard', 'advanced'].includes(difficulty) || !difficultyReason || typeof build !== 'function') throw new Error(`Некорректное расширение: ${id}`);
      templates.set(id, { id, grade, topicId, title, difficulty, difficultyReason, build });
    },
  });
}
registerGrade7(registrationApi(7));
registerGrade8(registrationApi(8));
registerGrade9(registrationApi(9));
registerGrade10(registrationApi(10));
registerGrade11(registrationApi(11));

// Preserve the 400-template pool used by v1.3/v1.4 before registering the
// second expansion. Old links retain both their pool and their versioned seed.
const previousTemplateIds = new Set(templates.keys());
registerMoreGrade7(registrationApi(7));
registerMoreGrade8(registrationApi(8));
registerMoreGrade9(registrationApi(9));
registerMoreGrade10(registrationApi(10));
registerMoreGrade11(registrationApi(11));

export const GRADES = Object.freeze(catalog.map(row => Object.freeze({ grade: row.grade, topics: Object.freeze(row.topics.map(item => Object.freeze(item))) })));

/** Public constructor catalog. Samples are used only for stable metadata, never stored as answers. */
export const TEMPLATE_CATALOG = Object.freeze([...templates.values()].map(template => {
  const sample = template.build(rng(`catalog:${BANK_VERSION}:${template.id}`));
  return Object.freeze({
    id: template.id, grade: template.grade, topicId: template.topicId,
    topicTitle: titleMap.get(template.topicId), title: template.title,
    difficulty: template.difficulty,
    difficultyTitle: DIFFICULTIES.find(item => item.id === template.difficulty).title,
    difficultyReason: template.difficultyReason, points: sample.points, kind: sample.kind,
  });
}));
export const BANK_STATS = Object.freeze({ grades: GRADES.length, topics: titleMap.size, templates: templates.size, programmingTemplates: TEMPLATE_CATALOG.filter(template => template.kind === 'program').length });

function configuration({ grade, topicId = 'all', count = 10, seed = 1430, difficulty = 'mixed', variant = 1, templateIds, bankVersion = BANK_VERSION } = {}) {
  if (!SUPPORTED_BANK_VERSIONS.includes(bankVersion)) throw new Error('Версия банка не поддерживается. Исходные задания не будут подменены.');
  const level = Number(grade);
  const gradeRow = GRADES.find(row => row.grade === level);
  if (!gradeRow) throw new Error('Выберите класс от 7 до 11.');
  if (!DIFFICULTIES.some(item => item.id === difficulty)) throw new Error('Неизвестный уровень сложности.');
  const variantNumber = Number(variant);
  if (!Number.isInteger(variantNumber) || variantNumber < 1 || variantNumber > 30) throw new Error('Номер варианта должен быть от 1 до 30.');
  const selectedTopics = topicId === 'all' ? gradeRow.topics.map(t => t.id) : gradeRow.topics.filter(t => t.id === topicId).map(t => t.id);
  if (!selectedTopics.length) throw new Error('Тема не найдена для выбранного класса.');
  if (templateIds != null && (!Array.isArray(templateIds) || !templateIds.length || templateIds.length > 60)) throw new Error('В плане работы должно быть от 1 до 60 заданий.');
  if (templateIds) {
    for (const id of templateIds) {
      const template = templates.get(id);
      if (!template || !isTemplateAvailable(id, bankVersion) || template.grade !== level || !selectedTopics.includes(template.topicId) || (difficulty !== 'mixed' && template.difficulty !== difficulty)) throw new Error('Шаблон не соответствует настройкам работы.');
    }
  }
  return { level, selectedTopics, topicId, total: templateIds?.length || Math.max(1, Math.min(60, Math.trunc(Number(count)) || 10)), seed, difficulty, variant: variantNumber, templateIds, bankVersion };
}

/** Variant-independent plan. Same assignment seed always selects the same concepts. */
export function generateBlueprint(options = {}) {
  const config = configuration(options);
  if (config.templateIds) return [...config.templateIds];
  const { level, selectedTopics, topicId, total, seed, difficulty, bankVersion } = config;
  const random = rng(`plan:${bankVersion}:${level}:${topicId}:${seed}:${difficulty}:${total}`);
  const topicOrder = shuffle(selectedTopics, random);
  let levels;
  if (difficulty !== 'mixed') levels = Array(total).fill(difficulty);
  else if (total < 3) levels = levelOrder.slice(0, total);
  else {
    const basic = Math.max(1, Math.round(total * .4));
    const standard = Math.min(total - basic - 1, Math.max(1, Math.round(total * .4)));
    levels = [...Array(basic).fill('basic'), ...Array(standard).fill('standard'), ...Array(total - basic - standard).fill('advanced')];
  }
  const queues = new Map();
  const result = [];
  for (let index = 0; index < total; index++) {
    const topicKey = topicOrder[index % topicOrder.length];
    const requestedLevel = levels[index];
    const key = `${topicKey}:${requestedLevel}`;
    let queue = queues.get(key);
    if (!queue?.length) {
      queue = shuffle([...templates.values()].filter(t => t.topicId === topicKey && t.difficulty === requestedLevel && isTemplateAvailable(t.id, bankVersion)), random);
      if (!queue.length) throw new Error('Для этой темы пока нет заданий выбранного уровня.');
      if (queue.length > 1 && queue[0].id === result.at(-1)) [queue[0], queue[1]] = [queue[1], queue[0]];
      queues.set(key, queue);
    }
    result.push(queue.shift().id);
  }
  return result;
}

const fingerprint = question => JSON.stringify([question.prompt, question.code || '', (question.options || []).map(option => option.label).sort()]);

function buildQuestion(template, config, index, used, avoid = new Set()) {
  const random = rng(`data:${config.bankVersion}:${config.level}:${config.seed}:v${config.variant}:${index}:${template.id}`);
  let question, signature;
  for (let retry = 0; retry < 512; retry++) {
    question = template.build(random);
    signature = fingerprint(question);
    if (!used.has(signature) && !avoid.has(signature)) break;
  }
  const repeated = used.has(signature) || avoid.has(signature);
  used.add(signature);
  return {
    id: `g${config.level}-${String(config.seed).replace(/[^\w-]/g, '').slice(0, 30)}-v${config.variant}-${index + 1}-${template.id}`,
    templateId: template.id, topicId: template.topicId, topicTitle: titleMap.get(template.topicId), title: template.title,
    difficulty: template.difficulty, difficultyTitle: DIFFICULTIES.find(item => item.id === template.difficulty).title,
    difficultyReason: template.difficultyReason,
    ...question,
    ...(repeated ? { repeated: true, generationNote: 'У этого типа задания ограниченное число исходных данных; условие повторяется.' } : {}),
  };
}

export function generateQuestions(options = {}) {
  const config = configuration(options);
  const ids = generateBlueprint(options);
  const used = new Set();
  return ids.map((id, index) => buildQuestion(templates.get(id), config, index, used));
}

/** New questions for the same concepts as missed answers; the original work stays intact. */
export function generatePracticeQuestions(missedQuestions, { seed = 1430, variant = 1, bankVersion = BANK_VERSION } = {}) {
  if (!Array.isArray(missedQuestions) || !missedQuestions.length) return [];
  if (missedQuestions.length > 60) throw new Error('Для одной тренировки доступно не более 60 заданий.');
  const ids = missedQuestions.map(question => question.templateId);
  const first = templates.get(ids[0]);
  if (!first || ids.some(id => !templates.has(id) || templates.get(id).grade !== first.grade)) throw new Error('Не удалось найти исходные типы заданий в текущем банке.');
  const config = configuration({ grade: first.grade, topicId: 'all', templateIds: ids, seed, variant, bankVersion });
  const avoid = new Set(missedQuestions.map(fingerprint));
  const used = new Set();
  return ids.map((id, index) => {
    const question = buildQuestion(templates.get(id), config, index, used, avoid);
    return { ...question, id: `${question.id}-practice`, practiceOf: missedQuestions[index].id, practiceRepeated: Boolean(question.repeated),
      ...(question.repeated ? { practiceNote: 'Для этого типа не удалось подобрать неповторяющееся условие. Повторите способ решения на прежнем условии.' } : {}) };
  });
}

const normalize = value => String(value ?? '').trim().replace(/\u2212/g, '-').replace(/\s+/g, '').toUpperCase();

export function checkAnswer(question, answer) {
  const maxScore = Number(question.points) || 1;
  if (question.kind === 'program') return { correct: false, score: 0, maxScore };
  const actual = normalize(answer);
  const expected = [question.answer, ...(question.acceptedAnswers || [])];
  let correct = false;
  if (actual) {
    if (question.kind === 'number') {
      const number = Number(actual.replace(',', '.'));
      correct = Number.isFinite(number) && expected.some(value => {
        const target = Number(normalize(value).replace(',', '.'));
        return Number.isFinite(target) && (Number.isInteger(target) ? number === target : Math.abs(number - target) <= 1e-9);
      });
    } else {
      correct = expected.some(value => normalize(value) === actual);
    }
  }
  return { correct, score: correct ? maxScore : 0, maxScore };
}
