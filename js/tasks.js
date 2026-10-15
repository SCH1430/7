(function (root) {
  'use strict';

  const KB = 1024;
  const MB = KB * KB;
  const format = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(n);
  const categories = {
    graphics: { label: 'Изображения', short: 'Графика', icon: 'image' },
    audio: { label: 'Звук', short: 'Звук', icon: 'audio' },
    transfer: { label: 'Передача данных', short: 'Передача', icon: 'transfer' },
  };
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, rng) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const task = (type, category, title, level, unit, paragraphs, answer, solution, params) => ({
    type, category, title, level, unit, paragraphs, answer, solution, params,
  });

  const generators = [
    (r) => {
      const width = pick(r, [256, 512, 1024, 2048]);
      const height = pick(r, [128, 256, 512, 768]);
      const colors = pick(r, [16, 32, 64, 128, 200, 256, 400, 1024]);
      const depth = Math.ceil(Math.log2(colors));
      const answer = width * height * depth / 8 / KB;
      return task('image-size', 'graphics', 'Объём растрового изображения', 'Базовый', 'Кбайт', [
        `Растровое изображение размером ${width} × ${height} пикселей использует палитру из ${colors} цветов. Каждый пиксель кодируется одинаковым минимально возможным целым числом бит.`,
        'Какой объём памяти в Кбайт занимает изображение? Сжатие и заголовок файла не учитываются.',
      ], answer, [
        `Глубина цвета: i = ⌈log₂ ${colors}⌉ = ${depth} бит.`,
        `Объём: ${width} × ${height} × ${depth} = ${format(width * height * depth)} бит.`,
        `Переводим в Кбайт: ${format(width * height * depth)} / 8 / 1024 = ${format(answer)}.`,
      ], { width, height, colors });
    },
    (r) => {
      const width = pick(r, [256, 512, 1024]);
      const height = pick(r, [256, 512]);
      const depth = pick(r, [3, 5, 6, 7, 9, 10, 12]);
      const extra = pick(r, [0, 1, 2]);
      const memory = width * height * depth / 8 / KB + extra;
      const answer = 2 ** Math.floor(memory * KB * 8 / (width * height));
      return task('image-colors', 'graphics', 'Максимальная палитра', 'Базовый', 'цветов', [
        `Для хранения растрового изображения размером ${width} × ${height} пикселей отведено не более ${format(memory)} Кбайт. Каждый пиксель кодируется одинаковым целым числом бит.`,
        'Какое наибольшее количество цветов может содержать палитра? Сжатие и заголовок файла не учитываются.',
      ], answer, [
        `На один пиксель доступно не более ${format(memory)} × 1024 × 8 / (${width} × ${height}) бит.`,
        `Берём целую часть: i = ${Math.floor(memory * KB * 8 / (width * height))} бит.`,
        `Максимальное количество цветов: N = 2ⁱ = ${format(answer)}.`,
      ], { width, height, memory });
    },
    (r) => {
      const dpi = pick(r, [100, 150, 200]);
      const scale = pick(r, [2, 3, 4]);
      const oldDepth = pick(r, [8, 16]);
      const newDepth = pick(r, [8, 16, 24, 32]);
      const memory = pick(r, [128, 256, 512, 768]);
      const answer = memory * scale ** 2 * newDepth / oldDepth;
      return task('image-resolution', 'graphics', 'Повторное сканирование', 'Составной', 'Кбайт', [
        `Изображение отсканировали с разрешением ${dpi} dpi и глубиной цвета ${oldDepth} бит. Полученный файл без сжатия занимает ${memory} Кбайт.`,
        `Тот же оригинал сканируют с разрешением ${dpi * scale} dpi и глубиной цвета ${newDepth} бит. Каков объём нового файла в Кбайт? Заголовки не учитываются.`,
      ], answer, [
        `Линейное разрешение выросло в ${scale} раза, поэтому число пикселей выросло в ${scale ** 2} раза.`,
        `Объём меняется пропорционально числу пикселей и глубине цвета.`,
        `V₂ = ${memory} × ${scale}² × ${newDepth} / ${oldDepth} = ${format(answer)} Кбайт.`,
      ], { dpi, scale, oldDepth, newDepth, memory });
    },
    (r) => {
      const width = pick(r, [512, 1024, 2048]);
      const height = pick(r, [256, 512]);
      const depth = pick(r, [4, 6, 8, 10, 12]);
      const kept = pick(r, [50, 75]);
      const header = pick(r, [4, 8, 16]);
      const limit = width * height * depth / 8 / KB * kept / 100 + header;
      return task('image-compression', 'graphics', 'Палитра и сжатие', 'Составной', 'цветов', [
        `Растровое изображение имеет размер ${width} × ${height} пикселей. Каждый пиксель кодируется одинаковым целым числом бит. После сжатия объём данных изображения составляет ${kept}% от исходного. Затем добавляется заголовок объёмом ${header} Кбайт.`,
        `Готовый файл должен занимать не более ${format(limit)} Кбайт. Какое максимальное количество цветов может содержать палитра?`,
      ], 2 ** depth, [
        `На сжатые данные остаётся ${format(limit)} − ${header} = ${format(limit - header)} Кбайт.`,
        `До сжатия это (${format(limit)} − ${header}) / ${kept / 100} Кбайт.`,
        `i = ⌊(${format(limit)} − ${header}) × 1024 × 8 / (${kept / 100} × ${width} × ${height})⌋ = ${depth} бит.`,
        `N = 2^${depth} = ${format(2 ** depth)} цветов.`,
      ], { width, height, kept, header, limit });
    },
    (r) => {
      const frequency = pick(r, [8192, 16384, 32768]);
      const depth = pick(r, [8, 16, 24]);
      const channels = pick(r, [1, 2]);
      const seconds = pick(r, [32, 48, 64, 96, 128]);
      const answer = frequency * depth * channels * seconds / 8 / MB;
      return task('audio-size', 'audio', 'Объём аудиозаписи', 'Базовый', 'Мбайт', [
        `Звук записывают с частотой дискретизации ${format(frequency)} Гц и глубиной кодирования ${depth} бит. Количество каналов — ${channels}. Длительность записи — ${seconds} с.`,
        'Определите объём несжатых звуковых данных в Мбайт. Служебная информация не учитывается.',
      ], answer, [
        `Объём звука: V = f × i × k × t.`,
        `V = ${frequency} × ${depth} × ${channels} × ${seconds} = ${format(frequency * depth * channels * seconds)} бит.`,
        `В Мбайт: V / (8 × 1024²) = ${format(answer)}.`,
      ], { frequency, depth, channels, seconds });
    },
    (r) => {
      const frequency = pick(r, [16000, 24000, 32000, 48000]);
      const depth = pick(r, [8, 16, 24]);
      const channels = pick(r, [1, 2]);
      const memory = pick(r, [4, 8, 16, 32]);
      const answer = Math.floor(memory * MB * 8 / (frequency * depth * channels));
      return task('audio-duration', 'audio', 'Длительность записи', 'Базовый', 'с', [
        `Для несжатой аудиозаписи выделено ${memory} Мбайт памяти. Запись ведётся с частотой ${format(frequency)} Гц, глубиной кодирования ${depth} бит и числом каналов ${channels}.`,
        'Какое максимальное целое число секунд записи поместится в памяти? Служебная информация не учитывается.',
      ], answer, [
        `За секунду: ${frequency} × ${depth} × ${channels} = ${format(frequency * depth * channels)} бит.`,
        `t ≤ ${memory} × 1024² × 8 / (${frequency} × ${depth} × ${channels}).`,
        `Округляем вниз, чтобы не превысить память: ${answer} с.`,
      ], { frequency, depth, channels, memory });
    },
    (r) => {
      const frequency = pick(r, [8192, 16384, 32768]);
      const channels = pick(r, [1, 2]);
      const seconds = pick(r, [32, 64, 128]);
      const depth = pick(r, [8, 12, 16, 24, 32]);
      const memory = frequency * channels * seconds * depth / 8 / MB;
      return task('audio-depth', 'audio', 'Глубина кодирования звука', 'Базовый', 'бит', [
        `Несжатая аудиозапись длительностью ${seconds} с занимает ${format(memory)} Мбайт. Частота дискретизации — ${format(frequency)} Гц, количество каналов — ${channels}.`,
        'Какова глубина кодирования звука в битах? Служебная информация не учитывается.',
      ], depth, [
        `V = f × i × k × t, поэтому i = V / (f × k × t).`,
        `i = ${format(memory)} × 1024² × 8 / (${frequency} × ${channels} × ${seconds}) = ${depth} бит.`,
      ], { frequency, channels, seconds, memory });
    },
    (r) => {
      const oldFrequency = pick(r, [16000, 22050, 24000]);
      const factor = pick(r, [2, 4]);
      const oldDepth = pick(r, [8, 16]);
      const newDepth = pick(r, [16, 24, 32]);
      const memory = pick(r, [4, 8, 12, 16]);
      const answer = memory * factor * newDepth / oldDepth * 2;
      return task('audio-conversion', 'audio', 'Изменение параметров записи', 'Составной', 'Мбайт', [
        `Монофоническая запись с частотой ${format(oldFrequency)} Гц и глубиной ${oldDepth} бит занимает ${memory} Мбайт.`,
        `Тот же фрагмент записали в стереоформате (2 канала) с частотой ${format(oldFrequency * factor)} Гц и глубиной ${newDepth} бит. Длительность не изменилась. Определите новый объём в Мбайт. Обе записи не сжаты, заголовки не учитываются.`,
      ], answer, [
        `Частота увеличилась в ${factor} раза, число каналов — в 2 раза.`,
        `V₂ = V₁ × (f₂ / f₁) × (i₂ / i₁) × (k₂ / k₁).`,
        `V₂ = ${memory} × ${factor} × ${newDepth} / ${oldDepth} × 2 = ${answer} Мбайт.`,
      ], { oldFrequency, factor, oldDepth, newDepth, memory });
    },
    (r) => {
      const width = pick(r, [512, 1024, 2048]);
      const height = pick(r, [256, 512, 1024]);
      const depth = pick(r, [8, 16, 24]);
      const speed = pick(r, [32768, 65536, 131072, 262144]);
      const answer = width * height * depth / speed;
      return task('image-transfer', 'transfer', 'Время передачи изображения', 'Базовый', 'с', [
        `Растровое изображение размером ${width} × ${height} пикселей с глубиной цвета ${depth} бит передаётся по каналу со скоростью ${format(speed)} бит/с.`,
        'Сколько секунд займёт передача? Сжатие, заголовки и служебные расходы канала не учитываются.',
      ], answer, [
        `Размер изображения: ${width} × ${height} × ${depth} = ${format(width * height * depth)} бит.`,
        `Время: t = V / v = ${format(width * height * depth)} / ${speed} = ${format(answer)} с.`,
      ], { width, height, depth, speed });
    },
    (r) => {
      const frequency = pick(r, [16000, 24000, 32000]);
      const depth = pick(r, [8, 16, 24]);
      const channels = pick(r, [1, 2]);
      const seconds = pick(r, [30, 60, 90, 120]);
      const kept = pick(r, [25, 50, 75]);
      const speed = pick(r, [32000, 64000, 128000]);
      const answer = frequency * depth * channels * seconds * kept / 100 / speed;
      return task('audio-transfer', 'transfer', 'Передача сжатого звука', 'Составной', 'с', [
        `Записан звук длительностью ${seconds} с, с частотой ${format(frequency)} Гц, глубиной ${depth} бит и числом каналов ${channels}. После сжатия объём составляет ${kept}% от несжатого.`,
        `Сколько секунд займёт передача сжатой записи со скоростью ${format(speed)} бит/с? Заголовки и служебные расходы канала не учитываются.`,
      ], answer, [
        `Несжатый объём: ${frequency} × ${depth} × ${channels} × ${seconds} бит.`,
        `После сжатия оставляем ${kept}%: V = ${format(frequency * depth * channels * seconds * kept / 100)} бит.`,
        `t = V / ${speed} = ${format(answer)} с.`,
      ], { frequency, depth, channels, seconds, kept, speed });
    },
    (r) => {
      const width = pick(r, [256, 512, 1024]);
      const height = pick(r, [256, 512]);
      const depth = pick(r, [8, 16, 24]);
      const header = pick(r, [2, 4, 8]);
      const speed = pick(r, [128, 256, 512]);
      const seconds = pick(r, [30, 60, 90]);
      const bytes = width * height * depth / 8 + header * KB;
      const answer = Math.floor(speed * KB * seconds / bytes);
      return task('image-batch', 'transfer', 'Передача пакета фотографий', 'Составной', 'файлов', [
        `Каждая фотография имеет размер ${width} × ${height} пикселей и глубину цвета ${depth} бит. К данным каждой фотографии добавляется заголовок ${header} Кбайт. Сжатие не используется.`,
        `Какое максимальное количество целых файлов можно передать за ${seconds} с по каналу со скоростью ${speed} Кбайт/с? Другими служебными расходами пренебречь.`,
      ], answer, [
        `Один файл: ${width} × ${height} × ${depth} / 8 + ${header} × 1024 = ${format(bytes)} байт.`,
        `Канал передаст ${speed} × 1024 × ${seconds} = ${format(speed * KB * seconds)} байт.`,
        `Количество целых файлов: ⌊${format(speed * KB * seconds)} / ${format(bytes)}⌋ = ${answer}.`,
      ], { width, height, depth, header, speed, seconds });
    },
    (r) => {
      const frequency = pick(r, [22050, 44100, 48000]);
      const depth = pick(r, [8, 16, 24]);
      const channels = pick(r, [1, 2]);
      const seconds = pick(r, [30, 60, 90]);
      const transferSeconds = pick(r, [7, 11, 13, 17]);
      const answer = Math.ceil(frequency * depth * channels * seconds / transferSeconds);
      return task('audio-speed', 'transfer', 'Минимальная скорость канала', 'Составной', 'бит/с', [
        `Аудиозапись длительностью ${seconds} с создана с частотой ${format(frequency)} Гц, глубиной ${depth} бит и числом каналов ${channels}. Сжатие не используется.`,
        `Найдите минимальную целую скорость канала в бит/с, достаточную для передачи записи не более чем за ${transferSeconds} с. Заголовки и служебные расходы не учитываются.`,
      ], answer, [
        `Объём: V = ${frequency} × ${depth} × ${channels} × ${seconds} = ${format(frequency * depth * channels * seconds)} бит.`,
        `Скорость должна быть не меньше V / ${transferSeconds}.`,
        `Округляем вверх: v = ⌈${format(frequency * depth * channels * seconds)} / ${transferSeconds}⌉ = ${format(answer)} бит/с.`,
      ], { frequency, depth, channels, seconds, transferSeconds });
    },
  ];

  function generateQuestions(count, seed) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('Invalid question count');
    const rng = random(seed);
    const result = [];
    const signatures = new Set();
    while (result.length < count) {
      // Interleave the three groups so even a short session covers each topic.
      const groups = [generators.slice(0, 4), generators.slice(4, 8), generators.slice(8, 12)].map(g => shuffle(g, rng));
      const round = [];
      for (let i = 0; i < 4; i++) round.push(...shuffle(groups.map(g => g[i]), rng));
      for (const generate of round) {
        let q;
        let signature;
        do { q = generate(rng); signature = JSON.stringify(q.params) + q.type; } while (signatures.has(signature));
        signatures.add(signature);
        result.push(q);
        if (result.length === count) break;
      }
    }
    return shuffle(result, rng).map((q, i) => ({ ...q, id: `${seed}-${i}` }));
  }

  const api = { KB, MB, format, categories, random, shuffle, generators, generateQuestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EgeTasks = api;
})(globalThis);
