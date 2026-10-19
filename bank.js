(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else factory(root.TrainerCore);})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  if(C.bankUpgraded)return C;
  const metadata={
    'base-1':[['Устройства ввода и вывода'],1,2,['Компоненты компьютера'],'Выбери все устройства ввода.'],
    'base-2':[['Пути к файлам'],1,2,['Файл Фото.jpg','Новый каталог Лето','Вариант для Windows'],'Восстанови полный путь до перемещения.'],
    'base-3':[['Расширения файлов'],1,2,['wav · odt · png · rar'],'Сопоставь каждое расширение с типом файла.'],
    'base-4':[['Интернет-адреса'],2,3,['HTTPS','test.org','info.docx'],'Собери адрес и запиши номера фрагментов.'],
    'base-5':[['Логические исключения'],2,4,['Три имени','Три фамилии','Начальные буквы не совпадают'],'Определи фамилию каждой девочки.'],
    'base-6':[['Декодирование'],2,4,['Радиограмма без границ букв','Таблица из 6 кодов'],'Расшифруй сообщение по данной таблице.'],
    'base-7':[['Биты и байты','Вместимость памяти'],1,2,['4 Кбайт памяти','32 байта на файл','1 Кбайт = 1024 байта'],'Найди количество файлов.'],
    'base-8':[['Кодирование текста'],1,2,['Алфавит из 256 символов','32 символа в файле'],'Найди информационный объём в байтах.'],
    'base-9':[['Биты и байты','Передача данных'],2,3,['4 файла по 16 байт','Скорость 64 бит/с'],'Найди время передачи в секундах.'],
    'base-10':[['Подсчёт символов','Кодирование текста'],1,2,['16 бит на символ','Пробелы и знаки учитываются'],'Посчитай объём предложения в байтах.'],
    'base-11':[['Цветовая модель RGB'],1,2,['Красный: 255','Зелёный: 0','Синий: 255'],'Определи цвет по трём каналам.'],
    'base-12':[['Форматирование текста'],2,4,['Фрагмент документа','Горизонтальная линейка'],'Отметь все использованные свойства оформления.'],
    'base-13':[['Поиск в тексте'],2,3,['Короткий полный учебный фрагмент','Учитывается именительный падеж'],'Посчитай подходящие слова с частью «сын».'],
    'base-14':[['Абзацы и таблицы'],2,5,['Команды текстового редактора','Исходная таблица 3 × 3'],'Определи результат двух последовательностей действий.'],
    'base-15':[['Преобразования изображений'],1,2,['Исходная картинка','Результат обработки'],'Выбери два применённых инструмента.'],
    'advanced-1':[['Декодирование'],3,6,['7 буквенных кодов','4 двоичные цепочки'],'Найди единственную однозначно расшифровываемую цепочку.'],
    'advanced-2':[['Кодирование текста'],2,3,['Алфавит из 64 символов','Сообщение из 80 символов'],'Определи объём сообщения в байтах.'],
    'advanced-3':[['Устройства ввода и вывода'],1,2,['Компоненты компьютера'],'Выбери все устройства вывода.'],
    'advanced-4':[['Оценка размера файлов'],2,3,['Три файла','Фотография больше презентации, презентация больше документа'],'Сопоставь размеры по заданному порядку.'],
    'advanced-5':[['Пути к файлам'],1,2,['Каталог 7 класс','Каталог 2024 в корне диска C'],'Определи путь после перемещения каталога.'],
    'advanced-6':[['Интернет-адреса'],2,3,['HTTPS','exam.inf','kr7.pdf'],'Запиши номера фрагментов с учётом повторения.'],
    'advanced-7':[['Передача данных'],2,3,['60 000 000 бит/с','10 секунд','Новая скорость 50 000 000 бит/с'],'Найди время передачи того же файла.'],
    'advanced-8':[['Кодирование текста','Биты и байты'],2,4,['8 страниц · 32 строки · 40 символов','16 бит на символ'],'Найди объём статьи в Кбайтах.'],
    'advanced-9':[['Глубина цвета'],3,5,['128 × 128 пикселей','8 Кбайт','Без сжатия и служебных данных'],'Определи число цветов в палитре.'],
    'advanced-10':[['Объём звука','Биты и байты'],3,5,['2 канала','16 бит · 16 кГц','256 секунд'],'Найди объём несжатой записи в Кбайтах.'],
    'advanced-11':[['Форматирование текста'],3,6,['Фрагмент документа','Две линейки с сантиметровыми делениями'],'Определи отступы, поля страницы и выравнивание.'],
    'advanced-12':[['Логические условия'],2,4,['s ≤ 2 и k ≤ 3','Девять пар входных значений'],'Посчитай запуски с ответом «ДА».'],
    'advanced-13':[['Циклы и остаток от деления'],2,3,['Целые числа от 0 до 9','Проверка i % 4 == 0'],'Найди итоговое значение счётчика.']
  };
  C.difficultyLabels={1:'Начальный',2:'Стандартный',3:'Со звёздочкой'};
  for(const b of C.bank){const [skills,difficulty,estimatedMinutes,given,prompt]=metadata[b.id];Object.assign(b.task,{bankId:b.id,family:b.id,skills,difficulty,estimatedMinutes,given,prompt,sourceImage:`assets/sources/${b.id}.png`,needsFullSource:['base-13','base-14'].includes(b.id),sourceStatus:b.task.adapted?'adapted':'screenshot'});}
  const baseDiagnostics={
    'base-7':{'0.125':'Ёмкость в Кбайтах разделена на байты без перевода единиц. Сначала умножь Кбайты на 1024.','64':'Проверь перевод 4 Кбайт в байты и деление на 32. Здесь не нужно делить объём памяти на 2.'},
    'base-8':{'256':'Мощность алфавита не равна объёму сообщения. Сначала найди число бит на один символ.'},
    'base-9':{'1':'Возможно, байты были разделены на биты в секунду. Перед делением переведи весь объём в биты.','2':'Похоже, учтён только один файл. Передаются четыре файла.'},
    'base-10':{'30':'Проверь, включены ли в подсчёт пробел и точка.','256':'Результат похож на объём в битах. В условии нужны байты: раздели на 8.'},
    'advanced-2':{'480':'Это объём в битах. Для ответа в байтах раздели результат на 8.','80':'Один символ этого алфавита занимает 6 бит, а не один байт.'},
    'advanced-7':{'8.33333333333':'При меньшей скорости передача того же файла должна занимать больше времени.','10':'Скорость изменилась. Сначала вычисли объём файла по исходным данным.'},
    'advanced-8':{'20480':'Похоже, получены байты. Переведи их в Кбайты, разделив на 1024.'},
    'advanced-9':{'4':'Это глубина цвета в битах. Количество цветов равно 2 в степени глубины.','256':'Найди глубину по объёму именно этого изображения, а не используй привычные 8 бит.'},
    'advanced-10':{'8000':'Возможно, учтён один канал. Стереозапись содержит два канала.','131072000':'Это объём в битах. Для Кбайт нужно разделить на 8 и затем на 1024.'},
    'advanced-12':{'8':'Оператор and требует выполнения обоих условий одновременно, а не хотя бы одного.'},
    'advanced-13':{'2':'Проверь ноль: 0 % 4 тоже равно 0.','10':'Счётчик увеличивается только при выполнении условия, а не на каждой итерации.'}
  };
  for(const b of C.bank)b.task.diagnostics=baseDiagnostics[b.id]||{};
  function addFamily(originId,count,build){const origin=C.bank.find(b=>b.id===originId);for(let i=1;i<=count;i++){const t=build(i);t.body+=`<p class="given">${t.given.join(' · ')}</p><p>${t.prompt}</p>`;const id=`${originId}-practice-${i}`;Object.assign(t,{bankId:id,family:originId,skills:[...origin.task.skills],difficulty:origin.task.difficulty,estimatedMinutes:origin.task.estimatedMinutes,source:`Учебная версия семейства ${origin.label}`,generated:true,sourceStatus:'practice',sourceImage:origin.task.sourceImage,adapted:false});C.bank.push({id,level:origin.level,number:origin.number,task:t,label:`${origin.level==='base'?'Базовый':'Углублённый'} · практика ${origin.number}.${i}`});}}
  const numericTask=(origin,title,body,answer,steps,given,prompt,diagnostics={})=>({title,topic:C.bank.find(b=>b.id===origin).task.topic,body,fields:[{label:'Ответ числом без единиц измерения',type:'text',numeric:true,correct:String(answer)}],steps,given,prompt,diagnostics});
  addFamily('base-7',4,i=>{const kb=[2,8,16,32][i-1],size=[16,32,256,64][i-1],bytes=kb*1024;return numericTask('base-7',`Вместимость памяти · ${i}`,`<p>В памяти микроконтроллера хранятся файлы одинакового размера. Служебные данные не учитываются.</p>`,bytes/size,[`${kb} × 1024 = ${bytes} байт.`,`${bytes} ÷ ${size} = ${bytes/size} файлов.`],[`${kb} Кбайт памяти`,`${size} байт на файл`,'1 Кбайт = 1024 байта'],'Сколько файлов поместится в памяти?',{[kb/size]:'Сначала переведи ёмкость памяти из Кбайт в байты.'});});
  addFamily('base-8',4,i=>{const n=[48,72,96,120][i-1];return numericTask('base-8',`Текст в КОИ-8 · ${i}`,'<p>Текстовый файл использует равномерное кодирование символов. Служебные данные не учитываются.</p>',n,[`256 = 2⁸, значит, символ занимает 8 бит = 1 байт.`,`${n} × 1 = ${n} байт.`],['Алфавит из 256 символов',`${n} символов в сообщении`],'Найди объём сообщения в байтах.',{[n*8]:'Получен объём в битах. Ответ требуется в байтах.'});});
  addFamily('base-9',4,i=>{const files=i+1,bytes=16*i,rate=32*i,ans=files*bytes*8/rate;return numericTask('base-9',`Передача набора файлов · ${i}`,'<p>Несколько одинаковых файлов передаются последовательно по одному соединению. Накладные расходы не учитываются.</p>',ans,[`Общий объём: ${files} × ${bytes} × 8 = ${files*bytes*8} бит.`,`Время: ${files*bytes*8} ÷ ${rate} = ${ans} с.`],[`${files} файла по ${bytes} байт`,`${rate} бит/с`],'Сколько секунд займёт передача всех файлов?',{[ans/8]:'Возможно, пропущен перевод байтов в биты.',[ans/files]:'Возможно, посчитано время только для одного файла.'});});
  addFamily('base-10',4,i=>{const phrase=['Учимся думать.','Решение найдено!','Школа 1430.','Практика помогает.'][i-1];return numericTask('base-10',`Объём короткой фразы · ${i}`,`<p>Каждый символ кодируется 16 битами. Пробелы, цифры и знаки препинания учитываются.</p><blockquote>${phrase}</blockquote>`,phrase.length*2,[`Во фразе ${phrase.length} символов.`,`16 бит = 2 байта. Объём: ${phrase.length} × 2 = ${phrase.length*2} байт.`],['16 бит на символ','Все видимые символы учитываются'],'Найди объём фразы в байтах.',{[phrase.length*16]:'Получен объём в битах, а нужны байты.'});});
  addFamily('advanced-2',4,i=>{const alphabet=[16,32,128,256][i-1],bits=Math.log2(alphabet),n=[96,80,64,48][i-1],ans=n*bits/8;return numericTask('advanced-2',`Алфавит и сообщение · ${i}`,'<p>Сообщение записано символами алфавита с равномерным двоичным кодом.</p>',ans,[`${alphabet} = 2 в степени ${bits}: на символ приходится ${bits} бит.`,`${n} × ${bits} ÷ 8 = ${ans} байт.`],[`${alphabet} символов в алфавите`,`${n} символов в сообщении`],'Определи объём сообщения в байтах.',{[n*bits]:'Это число бит. Раздели его на 8 для перевода в байты.'});});
  addFamily('advanced-7',4,i=>{const r1=[24,36,48,72][i-1],r2=[16,24,32,48][i-1],time=[8,10,12,16][i-1],ans=r1*time/r2;return numericTask('advanced-7',`Сравнение скоростей · ${i}`,'<p>Один и тот же файл передаётся через два соединения. Накладные расходы не учитываются.</p>',ans,[`Объём: ${r1} × ${time} = ${r1*time} Мбит.`,`Новое время: ${r1*time} ÷ ${r2} = ${ans} с.`],[`Исходная скорость ${r1} Мбит/с`,`Исходное время ${time} с`,`Новая скорость ${r2} Мбит/с`],'Найди время передачи через второе соединение.',{[time]:'Скорость изменилась: время тоже должно измениться. Объём файла остаётся прежним.'});});
  addFamily('advanced-8',4,i=>{const pages=[4,8,16,20][i-1],rows=32,chars=32,ans=pages*rows*chars*2/1024;return numericTask('advanced-8',`Объём статьи · ${i}`,'<p>Статья набрана равномерно. Служебные данные не учитываются.</p>',ans,[`Число символов: ${pages} × ${rows} × ${chars} = ${pages*rows*chars}.`,`Объём: ${pages*rows*chars} × 2 ÷ 1024 = ${ans} Кбайт.`],[`${pages} страниц`,`${rows} строки на странице`,`${chars} символа в строке`,'16 бит на символ; 1 Кбайт = 1024 байта'],'Определи объём статьи в Кбайтах.',{[ans*1024]:'Результат выражен в байтах. Переведи его в Кбайты.'});});
  addFamily('advanced-9',4,i=>{const side=[64,128,256,128][i-1],depth=[2,8,4,2][i-1],kb=side*side*depth/8/1024;return numericTask('advanced-9',`Палитра растра · ${i}`,'<p>Растровое изображение хранится без сжатия. Заголовки и палитра в объём не включаются.</p>',2**depth,[`Глубина: ${kb} × 1024 × 8 ÷ (${side} × ${side}) = ${depth} бит/пиксель.`,`Количество цветов: 2 в степени ${depth} = ${2**depth}.`],[`${side} × ${side} пикселей`,`${kb} Кбайт`,'1 Кбайт = 1024 байта'],'Найди максимальное число цветов.',{[depth]:'Это число бит на пиксель. Число цветов равно 2 в этой степени.'});});
  addFamily('advanced-10',4,i=>{const channels=[1,2,2,1][i-1],bits=16,hz=[8000,8000,16000,32000][i-1],time=[64,128,64,32][i-1],ans=channels*bits*hz*time/8/1024;return numericTask('advanced-10',`Объём аудиозаписи · ${i}`,'<p>Звук записывается без сжатия. Служебные данные не учитываются.</p>',ans,[`Объём: ${channels} × ${bits} × ${hz} × ${time} = ${ans*8192} бит.`,`В Кбайтах: ${ans*8192} ÷ 8 ÷ 1024 = ${ans}.`],[`${channels} канал(а) · ${bits} бит`,`${hz/1000} кГц · ${time} с`,'1 кГц = 1000 Гц; 1 Кбайт = 1024 байта'],'Найди объём записи в Кбайтах.',{[ans*8]:'Проверь перевод битов в байты: нужно разделить на 8.'});});
  addFamily('advanced-13',4,i=>{const limit=[12,21,31,43][i-1],divisor=[3,5,6,7][i-1],values=Array.from({length:limit},(_,n)=>n).filter(n=>n%divisor===0);return numericTask('advanced-13',`Счётчик в цикле · ${i}`,`<pre class="python">s = 0\nfor i in range(${limit}):\n    if i % ${divisor} == 0:\n        s = s + 1\nprint(s)</pre>`,values.length,[`Перебираются числа от 0 до ${limit-1}.`,`Условию отвечают ${values.join(', ')}. Счётчик равен ${values.length}.`],[`range(${limit}): правая граница не включается`,`Делитель ${divisor}`],'Какое число выведет программа?',{[values.length-1]:'Проверь ноль: остаток от его деления тоже равен нулю.'});});
  function feedback(t,answers){return t.fields.flatMap((f,j)=>{const value=answers?.[j];if(C.fieldCorrect(f,value))return [];const label=f.label;if(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length))return [{label,message:'Ответ не заполнен. Начни с вопроса задания и проверь, в каких единицах нужен результат.'}];if(Array.isArray(f.correct)){const got=Array.isArray(value)?value:[],missing=f.correct.filter(x=>!got.includes(x)),extra=got.filter(x=>!f.correct.includes(x));return [{label,message:[missing.length?`Не выбрано: ${missing.join(', ')}.`:'',extra.length?`Лишний выбор: ${extra.join(', ')}.`:'','Для балла должны совпасть все выбранные элементы.'].filter(Boolean).join(' ')}];}
    if(f.type==='text'&&f.numeric&&!t.teacherEdited){const n=String(Number(String(value).replace(/\s/g,'').replace(',','.'))),diagnosis=t.diagnostics?.[n];if(diagnosis)return [{label,message:diagnosis}];}
    const reasons={'Принтер':'Принтер выводит информацию на бумагу.','Колонки':'Колонки выводят звук.','Микрофон':'Микрофон вводит звук в компьютер.','Оперативная память':'Это память, а не устройство ввода или вывода.','Синий':'Синий получается при активном синем канале и выключенном красном. Здесь красный тоже включён.','Жёлтый':'Жёлтый получается из красного и зелёного каналов; в условии зелёный выключен.','Белый':'Для белого нужны все три канала, а зелёный в условии выключен.'};
    const message=!t.teacherEdited&&reasons[value]?reasons[value]:f.options?`В части «${label}» выбран вариант «${String(value)}». Сопоставь его с условием: верный вариант — «${f.correct}».`:`В части «${label}» получено «${String(value)}», ожидается «${f.correct}». Проверь ${t.skills?.join(', ').toLowerCase()||'последовательность решения'}; ниже приведены шаги проверки.`;return [{label,message}];});}
  function autoVariant(config,rng=Math.random){const {count,topics,level='all',difficulty='mixed',uniqueFamilies=true,verifiedOnly=false,reviews={}}=config;
    if(!Number.isInteger(count)||count<1||count>30||!Array.isArray(topics)||!topics.length||new Set(topics).size!==topics.length||topics.length>count||topics.some(t=>!C.bank.some(b=>b.task.topic===t))||!['all','base','advanced'].includes(level)||!['mixed','1','2','3'].includes(String(difficulty)))throw Error('Выбери 1–30 заданий и хотя бы одну тему. Число заданий должно быть не меньше числа тем.');
    const pool=C.bank.filter(b=>topics.includes(b.task.topic)&&(level==='all'||b.level===level)&&(difficulty==='mixed'||b.task.difficulty===Number(difficulty))&&reviews[b.id]?.status!=='needs-fix'&&(!verifiedOnly||reviews[b.id]?.status==='verified'));
    const shuffled=a=>a.map(x=>({x,r:rng()})).sort((a,b)=>a.r-b.r).map(p=>p.x),orderedTopics=shuffled(topics),chosen=[],used=new Set(),diffCount={1:0,2:0,3:0};
    for(let turn=0;turn<count;turn++){const topic=orderedTopics[turn%orderedTopics.length];const candidates=shuffled(pool.filter(b=>b.task.topic===topic&&!chosen.includes(b.id)&&(!uniqueFamilies||!used.has(b.task.family))));if(!candidates.length)throw Error(`Для темы «${topic}» не хватает разных заданий с выбранными ограничениями. Уменьши количество, разреши несколько задач одного семейства или расширь фильтры.`);
      const weights={1:.35,2:.45,3:.2};candidates.sort((a,b)=>diffCount[a.task.difficulty]/weights[a.task.difficulty]-diffCount[b.task.difficulty]/weights[b.task.difficulty]);const b=candidates[0];chosen.push(b.id);used.add(b.task.family);diffCount[b.task.difficulty]++;}
    const taskIds=shuffled(chosen),minutes=Math.min(120,Math.max(5,Math.ceil(taskIds.reduce((n,id)=>n+C.bank.find(b=>b.id===id).task.estimatedMinutes,0)*1.2)));return {title:'Сбалансированная тренировка',minutes,taskIds};
  }
  function validateReview(id,r){const b=C.bank.find(b=>b.id===id);if(!b||!r||!['pending','verified','needs-fix'].includes(r.status)||typeof r.reviewer!=='string'||r.reviewer.length>100||typeof r.notes!=='string'||r.notes.length>2000||typeof r.sourceRef!=='string'||r.sourceRef.length>500||!Number.isFinite(r.at)||!r.checks||['condition','key','explanation','source'].some(k=>typeof r.checks[k]!=='boolean'))throw Error('Повреждённая карточка проверки.');
    const edit=r.edit?C.validateTaskEdits({[id]:r.edit},[id])[id]:undefined;if(r.status==='verified'&&(!r.reviewer.trim()||Object.values(r.checks).some(x=>x!==true)||(b.task.needsFullSource&&(!edit?.fullText||!r.sourceRef.trim()))))throw Error('Для подтверждения укажи имя учителя и проверь все четыре пункта. Для адаптации также нужны полное условие и ссылка/название полного источника.');
    return {status:r.status,reviewer:r.reviewer.trim(),notes:r.notes,sourceRef:r.sourceRef,at:r.at,checks:{condition:r.checks.condition,key:r.checks.key,explanation:r.checks.explanation,source:r.checks.source},...(edit?{edit}:{})};
  }
  function standardVariant(level,{reviews={}}={},rng=Math.random){
    if(!Object.hasOwn(C.levels,level))throw Error('Выбери базовый или углублённый уровень.');
    const count=C.levels[level].tasks.length,pool=C.bank.filter(b=>b.level===level&&reviews[b.id]?.status!=='needs-fix');
    const topics=[...new Set(C.bank.filter(b=>b.level===level).map(b=>b.task.topic))],minimum=Math.floor(count/topics.length);
    const shuffle=items=>{const result=[...items];for(let i=result.length-1;i>0;i--){const n=rng();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Не удалось случайно выбрать задания.');const j=Math.floor(n*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
    const groups=new Map(topics.map(topic=>[topic,new Map()]));
    for(const b of pool){const families=groups.get(b.task.topic),family=b.task.family||b.id;if(!families.has(family))families.set(family,[]);families.get(family).push(b);}
    for(const topic of topics)if(groups.get(topic).size<minimum)throw Error(`Не удалось собрать сбалансированный вариант: для темы «${topic}» нужно минимум ${minimum} разных семейства. Проверьте задания со статусом «Нужна правка».`);
    const extra=count-minimum*topics.length,eligible=shuffle(topics.filter(topic=>groups.get(topic).size>minimum));
    if(eligible.length<extra)throw Error('Недостаточно разных семейств для баланса тем. Проверьте задания со статусом «Нужна правка».');
    const extended=new Set(eligible.slice(0,extra)),chosen=[];
    for(const topic of topics){const families=groups.get(topic),take=minimum+(extended.has(topic)?1:0);for(const family of shuffle([...families.keys()]).slice(0,take)){const candidates=shuffle(families.get(family));chosen.push(candidates[0].id);}}
    const taskIds=shuffle(chosen);C.validateStandardSelection(level,taskIds);
    return {selectionMode:'random-v1',taskIds};
  }
  function studentKey(student){
    if(!student||typeof student.name!=='string'||typeof student.schoolClass!=='string')return null;
    const name=student.name.normalize('NFKC').toLowerCase().replace(/ё/g,'е').trim().replace(/\s+/g,' '),schoolClass=student.schoolClass.normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,'');
    return name&&schoolClass?JSON.stringify([name,schoolClass]):null;
  }
  function studentProgress(level,student,attempts=[],reviews={}){
    if(!Object.hasOwn(C.levels,level))throw Error('Неизвестный уровень банка.');
    const pool=C.bank.filter(b=>b.level===level&&reviews[b.id]?.status!=='needs-fix'),allowed=new Set(pool.map(b=>b.id)),key=studentKey(student);let cycle=1,seen=new Set();
    const records=[...new Map(attempts.filter(a=>a&&typeof a.id==='string').map(a=>[a.id,a])).values()].filter(a=>key&&studentKey(a)===key&&Number.isFinite(a.finishedAt)).sort((a,b)=>a.finishedAt-b.finishedAt||a.startedAt-b.startedAt||a.id.localeCompare(b.id));
    for(const a of records){
      let ids;try{ids=C.getLevel(a).tasks.map(t=>t.bankId).filter(id=>allowed.has(id));}catch{continue;}
      if(!ids.length)continue;
      const explicit=a.selectionMode==='rotation-v1'&&a.level===level?a.bankCycle:null;
      if(explicit){if(explicit<cycle)continue;if(explicit>cycle){cycle=explicit;seen=new Set();}}
      else if(allowed.size&&seen.size===allowed.size){cycle++;seen=new Set();}
      ids.forEach(id=>seen.add(id));
    }
    const remainingIds=pool.filter(b=>!seen.has(b.id)).map(b=>b.id);
    return {cycle,total:pool.length,completed:seen.size,remaining:remainingIds.length,seenIds:[...seen],remainingIds,availableIds:pool.map(b=>b.id),exhausted:pool.length>0&&!remainingIds.length};
  }
  function nextStudentVariant(level,{student,attempts=[],reviews={}}={},rng=Math.random){
    if(!studentKey(student))throw Error('Укажи фамилию, имя и класс для учёта пройденного банка.');
    const progress=studentProgress(level,student,attempts,reviews),remaining=progress.exhausted?progress.availableIds:progress.remainingIds,allowed=new Set(remaining);
    if(!remaining.length)throw Error('В этом уровне нет доступных заданий. Проверьте статусы банка.');
    const pick=list=>{const n=rng();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Не удалось случайно выбрать задания.');return list[Math.floor(n*list.length)];};
    const pool=C.bank.filter(b=>allowed.has(b.id)),groups=new Map(),chosen=[],usedFamilies=new Set(),counts={};
    for(const b of pool){if(!groups.has(b.task.topic))groups.set(b.task.topic,[]);groups.get(b.task.topic).push(b);}
    const count=Math.min(C.levels[level].tasks.length,pool.length);
    while(chosen.length<count){
      const topics=[...groups.keys()].filter(t=>groups.get(t).length),minimum=Math.min(...topics.map(t=>counts[t]||0));let candidates=topics.filter(t=>(counts[t]||0)===minimum);
      const diverse=candidates.filter(t=>groups.get(t).some(b=>!usedFamilies.has(b.task.family)));if(diverse.length)candidates=diverse;
      const topic=pick(candidates),rows=groups.get(topic),fresh=rows.filter(b=>!usedFamilies.has(b.task.family)),options=fresh.length?fresh:rows,families=[...new Set(options.map(b=>b.task.family))],family=pick(families),b=pick(options.filter(b=>b.task.family===family));
      chosen.push(b.id);usedFamilies.add(family);counts[topic]=(counts[topic]||0)+1;groups.set(topic,rows.filter(row=>row.id!==b.id));
    }
    for(let i=chosen.length-1;i>0;i--){const value=pick(Array.from({length:i+1},(_,n)=>n));[chosen[i],chosen[value]]=[chosen[value],chosen[i]];}
    const bankCycle=progress.cycle+(progress.exhausted?1:0);C.validateRotationSelection(level,chosen,bankCycle);
    return {selectionMode:'rotation-v1',bankCycle,taskIds:chosen};
  }
  const extendPacks=typeof module==='object'&&module.exports?require('./task-packs.js'):globalThis.TrainerTaskPacks;
  extendPacks(C);
  Object.assign(C,{bankUpgraded:true,feedback,autoVariant,standardVariant,studentKey,studentProgress,nextStudentVariant,validateReview});return C;
});
