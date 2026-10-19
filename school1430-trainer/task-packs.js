(function(root,factory){const extend=factory();if(typeof module==='object'&&module.exports)module.exports=extend;else root.TrainerTaskPacks=extend;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric=(label,answer)=>({label,type:'text',numeric:true,correct:String(answer)});
  const text=(label,answer)=>({label,type:'text',numeric:false,correct:String(answer)});
  const single=(label,options,correct)=>({label,type:'single',options,correct});
  const result=(body,fields,steps,given,prompt,input,diagnostics={})=>({body,fields,steps,given,prompt,verification:{input},diagnostics});
  const p=s=>`<p>${s}</p>`;
  const unit='1 Кбайт = 1024 байта; 1 байт = 8 бит';
  const models=[];
  function model(id,title,level,topic,skills,difficulty,minutes,build){models.push({id,title,level,topic,skills,difficulty,minutes,build});}

  model('kilobytes','Перевод Кбайтов в байты','base','Объём информации',['Биты и байты'],1,2,i=>{
    const kb=i+2;
    return result(p('Размер учебного файла указан в Кбайтах. Служебные данные не учитываются.'),[numeric('Размер в байтах',kb*1024)],[`В одном Кбайте 1024 байта.`,`${kb} × 1024 = ${kb*1024} байт.`],[`${kb} Кбайт`,unit],'Вырази размер файла в байтах.',{kb},{[kb*1000]:'В этой задаче в одном Кбайте 1024 байта, а не 1000.'});
  });
  model('bytes-bits','Перевод байтов в биты','base','Объём информации',['Биты и байты'],1,2,i=>{
    const bytes=17+i*13;
    return result(p('Пакет данных имеет заданный размер в байтах.'),[numeric('Размер в битах',bytes*8)],[`Один байт содержит 8 бит.`,`${bytes} × 8 = ${bytes*8} бит.`],[`${bytes} байт`,'1 байт = 8 бит'],'Сколько бит содержит пакет?',{bytes});
  });
  model('ram-free','Свободная оперативная память','base','Компьютер',['Оперативная память','Биты и байты'],2,3,i=>{
    const total=256+i*16,system=64+(i%4)*8,apps=5+i,each=4;
    const free=total-system-apps*each;
    return result(p('В учебной модели компьютер имеет оперативную память заданного объёма. Система и приложения используют непересекающиеся участки памяти; другие расходы не учитываются.'),[numeric('Свободно Мбайт',free)],[`Приложения занимают ${apps} × ${each} = ${apps*each} Мбайт.`,`Свободно: ${total} − ${system} − ${apps*each} = ${free} Мбайт.`],[`Всего ${total} Мбайт`,`Система: ${system} Мбайт`,`${apps} приложений по ${each} Мбайт`],'Сколько Мбайт оперативной памяти осталось свободными?',{total,system,apps,each});
  });
  model('files-fit','Файлы и неполный остаток памяти','base','Объём информации',['Вместимость памяти','Целая часть частного'],2,3,i=>{
    const kb=i+3,size=130+7*i,bytes=kb*1024,answer=Math.floor(bytes/size);
    return result(p('В памяти сохраняют только целые файлы одинакового размера. Неиспользованный остаток нельзя занять частью файла. Служебные данные не учитываются.'),[numeric('Максимальное количество файлов',answer)],[`${kb} × 1024 = ${bytes} байт.`,`Наибольшее целое число файлов: ${answer}. Проверка: ${answer*size} ≤ ${bytes}, а ${(answer+1)*size} > ${bytes}.`],[`${kb} Кбайт памяти`,`${size} байт на файл`,unit],'Сколько целых файлов поместится?',{kb,size});
  });
  model('phrase-size','Точная длина сообщения','base','Объём информации',['Подсчёт символов','Кодирование текста'],1,2,i=>{
    const names=['Маша','Илья','Нина','Олег','Вера'],newNames=[...names,'Роман','Анна','Лев','Соня','Данил'],actions=['сохраняет файл','проверяет код','рисует схему','строит таблицу','изучает алгоритм','открывает документ','запускает программу','решает пример'],j=i-30;
    const phrase=i<=29?`${names[(i-1)%5]} решает задачу ${i}.`:`${newNames[j%10]} ${actions[Math.floor(j/10)]}.`,bits=i%2?8:16;
    return result(p(`Каждый символ, включая пробелы, цифры и точку, занимает ${bits} бит. Кавычки в сообщение не входят.`)+`<blockquote>${esc(phrase)}</blockquote>`,[numeric('Объём в байтах',phrase.length*bits/8)],[`В сообщении ${phrase.length} символов.`,`${phrase.length} × ${bits} ÷ 8 = ${phrase.length*bits/8} байт.`],[`${bits} бит на символ`,'Считаем все символы внутри сообщения'],'Найди объём сообщения в байтах.',{phrase,bits});
  });
  model('alphabet-bits','Минимальная длина кода','advanced','Логика и кодирование',['Равномерное кодирование','Мощность алфавита'],2,3,i=>{
    const alphabet=5+i*7,bits=Math.ceil(Math.log2(alphabet));
    return result(p('Для каждого символа алфавита выделяют двоичный код одинаковой длины. Разным символам должны соответствовать разные коды.'),[numeric('Бит на один символ',bits)],[`${bits-1} бит дают только ${2**(bits-1)} кодов: этого недостаточно для ${alphabet} символов.`,`${bits} бит дают ${2**bits} кодов. Это минимальная подходящая длина.`],[`${alphabet} символов в алфавите`],'Какова минимальная длина кода одного символа в битах?',{alphabet});
  });
  model('message-length','Число символов по объёму','advanced','Объём информации',['Кодирование текста','Обратная задача'],2,3,i=>{
    const bits=3+i%6,count=8*(i+6),bytes=count*bits/8;
    return result(p('Сообщение записано равномерным двоичным кодом. Служебные данные не учитываются, все биты файла заняты кодами символов.'),[numeric('Число символов',count)],[`Объём в битах: ${bytes} × 8 = ${bytes*8}.`,`Число символов: ${bytes*8} ÷ ${bits} = ${count}.`],[`${bytes} байт`,`${bits} бит на символ`],'Сколько символов содержит сообщение?',{bits,bytes});
  });
  model('recoding','Изменение кодировки','advanced','Объём информации',['Кодирование текста','Изменение объёма'],2,3,i=>{
    const count=16*(i+2),before=8,after=i%2?16:32,delta=count*(after-before)/8;
    return result(p('Один и тот же текст перекодировали без изменения числа символов. Размер заголовков файла не учитывается.'),[numeric('Увеличение в байтах',delta)],[`На символ добавилось ${after-before} бит.`,`${count} × (${after} − ${before}) ÷ 8 = ${delta} байт.`],[`${count} символов`,`Было ${before} бит/символ`,`Стало ${after} бит/символ`],'На сколько байт увеличился файл?',{count,before,after});
  });
  model('transfer-volume','Объём переданных данных','advanced','Объём информации',['Передача данных','Биты и байты'],2,3,i=>{
    const rate=8*(i+3),seconds=5+i*2,kb=rate*seconds/8;
    return result(p('Данные передаются с постоянной скоростью без пауз и накладных расходов.'),[numeric('Объём в Кбайтах',kb)],[`Передано ${rate} × ${seconds} = ${rate*seconds} Кбит.`,`Один Кбайт содержит 8 Кбит. Объём: ${rate*seconds} ÷ 8 = ${kb} Кбайт.`],[`${rate} Кбит/с`,`${seconds} с`,'1 Кбит = 1024 бита; 1 Кбайт = 1024 байта'],'Сколько Кбайт передано?',{rate,seconds});
  });
  model('two-connections','Передача двумя участками','advanced','Объём информации',['Передача данных','Составная задача'],3,5,i=>{
    const part=24*(i+2),rate1=8,rate2=12,total=part/rate1+part/rate2;
    return result(p('Первую половину файла передают через одно соединение, затем вторую половину через другое. Передачи идут последовательно. Накладные расходы отсутствуют.'),[numeric('Общее время в секундах',total)],[`Половина файла: ${part*2} ÷ 2 = ${part} Кбайт.`,`Время первой части: ${part} ÷ ${rate1} = ${part/rate1} с.`,`Время второй: ${part} ÷ ${rate2} = ${part/rate2} с. Всего ${total} с.`],[`Файл: ${part*2} Кбайт`,`Первое соединение: ${rate1} Кбайт/с`,`Второе: ${rate2} Кбайт/с`],'За сколько секунд передадут весь файл?',{part,rate1,rate2});
  });
  model('raster-size','Объём растрового изображения','advanced','Графика и текст',['Глубина цвета','Объём растра'],2,4,i=>{
    const width=128,height=64*(i+1),depth=[4,8,16][i%3],kb=width*height*depth/8192;
    return result(p('Растровое изображение хранится без сжатия. Каждый пиксель занимает одинаковое число бит. Заголовок и таблица палитры в объём не входят.'),[numeric('Объём в Кбайтах',kb)],[`Пикселей: ${width} × ${height} = ${width*height}.`,`Объём: ${width*height} × ${depth} ÷ 8 ÷ 1024 = ${kb} Кбайт.`],[`${width} × ${height} пикселей`,`${depth} бит/пиксель`,unit],'Найди объём изображения в Кбайтах.',{width,height,depth});
  });
  model('palette-size','Палитра и объём изображения','advanced','Графика и текст',['Глубина цвета','Минимальное число бит'],3,5,i=>{
    const colors=3+i*3,width=64,height=32+i*8,depth=Math.ceil(Math.log2(colors)),bytes=width*height*depth/8;
    return result(p('Для цвета каждого пикселя используют минимально возможное одинаковое число бит. Сжатия нет, таблица палитры и служебные данные не учитываются.'),[numeric('Объём в байтах',bytes)],[`Нужно ${depth} бит на пиксель: ${2**(depth-1)} < ${colors} ≤ ${2**depth}.`,`${width} × ${height} × ${depth} ÷ 8 = ${bytes} байт.`],[`${width} × ${height} пикселей`,`${colors} цветов`,'1 байт = 8 бит'],'Сколько байт занимает изображение?',{colors,width,height});
  });
  const devices=[['Клавиатура','Ввод'],['Мышь','Ввод'],['Сканер','Ввод'],['Микрофон','Ввод'],['Веб-камера','Ввод'],['Монитор','Вывод'],['Принтер','Вывод'],['Колонки','Вывод'],['SSD-накопитель','Хранение'],['USB-флеш-накопитель','Хранение']];
  const deviceSets=[];
  for(let mask=1;mask<2**devices.length;mask++){const set=devices.filter((_,j)=>mask&(1<<j));if(set.length===5&&set.some(d=>d[1]==='Ввод')&&set.some(d=>d[1]!=='Ввод'))deviceSets.push(set);}
  model('input-devices','Выбор устройств ввода','base','Компьютер',['Устройства ввода и вывода'],1,2,i=>{
    const set=deviceSets[i-1],options=set.map(d=>d[0]),correct=set.filter(d=>d[1]==='Ввод').map(d=>d[0]);
    return result(p('Школьная студия использует перечисленные устройства. Рассматривай их основное назначение: ввод, вывод или хранение информации.')+p(options.map(esc).join(' · ')),[{label:'Все устройства ввода',type:'multi',options,correct}],[`Информацию в компьютер вводят: ${correct.join(', ')}.`,`Остальные устройства из списка предназначены для вывода или хранения.`],['Нужно выбрать полный набор'],'Отметь все устройства ввода.',{devices:set});
  });
  model('device-roles','Назначение устройств','advanced','Компьютер',['Компоненты компьютера','Назначение устройств'],2,3,i=>{
    const inputs=devices.slice(0,5).map(d=>d[0]),outputs=devices.slice(5,8).map(d=>d[0]),stores=['SSD-накопитель','Жёсткий диск','USB-флеш-накопитель','Карта памяти'],cpu=['Центральный процессор','Графический процессор'];
    const names=[inputs[(i-1)%5],outputs[Math.floor((i-1)/5)%3],stores[Math.floor((i-1)/15)%4],cpu[i%2]],roles=['Ввод','Вывод','Хранение','Обработка'];
    return result(p('Установи соответствие между устройством и его основным назначением в учебной модели. Для накопителя выбери хранение, для процессора — обработку.')+p(names.map(esc).join(' · ')),names.map((name,j)=>single(name,roles,roles[j])),names.map((name,j)=>`${name}: ${roles[j].toLowerCase()} информации.`),['Четыре устройства','Каждое значение нужно сопоставить отдельно'],'Укажи назначение каждого устройства.',{names,roles});
  });
  model('pixel-scale','Масштаб и число пикселей','base','Графика и текст',['Размеры изображения','Масштабирование'],2,3,i=>{
    const width=40+4*i,height=30+2*i,factor=i%2?2:3,answer=width*height*factor*factor;
    return result(p('Изображение увеличили: его ширина и высота стали больше в одно и то же число раз. Пропорции сохранены.'),[numeric('Пикселей после увеличения',answer)],[`Новая ширина: ${width} × ${factor} = ${width*factor}.`,`Новая высота: ${height} × ${factor} = ${height*factor}.`,`Пикселей: ${width*factor} × ${height*factor} = ${answer}.`],[`Было ${width} × ${height} пикселей`,`Каждая сторона увеличена в ${factor} раза`],'Сколько пикселей стало в изображении?',{width,height,factor});
  });
  model('sound-duration','Длительность несжатого звука','advanced','Объём информации',['Объём звука','Обратная задача'],3,5,i=>{
    const channels=i%2+1,bits=16,hz=8000,seconds=8*(i+3),kb=channels*bits*hz*seconds/8192;
    return result(p('Запись хранится без сжатия; служебные данные отсутствуют. Длительность нужно определить по объёму записи.'),[numeric('Длительность в секундах',seconds)],[`Объём одной секунды: ${channels} × ${bits} × ${hz} = ${channels*bits*hz} бит.`,`Весь объём: ${kb} × 1024 × 8 = ${kb*8192} бит.`,`Длительность: ${kb*8192} ÷ ${channels*bits*hz} = ${seconds} с.`],[`${kb} Кбайт`,`${channels} канал(а)`,`${bits} бит; ${hz} Гц`,unit],'Сколько секунд длится запись?',{channels,bits,hz,kb});
  });
  model('sound-change','Изменение параметров звука','advanced','Объём информации',['Объём звука','Пропорции'],3,4,i=>{
    const kb=16*(i+2),channels=1,newChannels=i%2?2:1,hz=8000,newHz=16000,bits=8,newBits=i%3?16:8,answer=kb*(newChannels/channels)*(newHz/hz)*(newBits/bits);
    return result(p('Одну и ту же по длительности запись сделали с другими параметрами. В обоих случаях звук несжатый, служебные данные не учитываются.'),[numeric('Новый объём в Кбайтах',answer)],[`Число каналов меняется в ${newChannels/channels} раза, частота — в ${newHz/hz}, разрядность — в ${newBits/bits}.`,`Новый объём: ${kb} × ${newChannels/channels} × ${newHz/hz} × ${newBits/bits} = ${answer} Кбайт.`],[`Было: ${kb} Кбайт; ${channels} канал; ${hz} Гц; ${bits} бит`,`Стало: ${newChannels} канал(а); ${newHz} Гц; ${newBits} бит`],'Найди объём новой записи в Кбайтах.',{kb,channels,newChannels,hz,newHz,bits,newBits});
  });
  model('file-move','Перемещение файла в Windows','base','Файлы и Интернет',['Пути к файлам'],1,2,i=>{
    const disk=i%2?'C':'D',j=i-30,names=['План.txt','Заметки.txt','Доклад.odt','Таблица.ods','Фото.png','Схема.svg','Звук.wav','Архив.zip','Программа.py','Презентация.odp'],folders=['Литература','Математика','Информатика','История','Физика','География','Биология','Технология'];
    const file=i<=29?`Работа${i}.txt`:names[j%10],from=i<=29?`${disk}:\\Уроки\\Группа${i%5+1}\\${file}`:`${disk}:\\Материалы\\Черновики\\${file}`,folder=i<=29?`${disk}:\\Проекты\\Тема${i+2}`:`${disk}:\\Проекты\\${folders[Math.floor(j/10)]}\\Готово`,answer=`${folder}\\${file}`;
    return result(p('Файл переместили целиком в указанную папку. Имя и расширение файла не менялись.')+`<pre>${esc(from)}</pre>`,[text('Новый полный путь',answer)],[`Новый каталог: ${folder}.`,`Добавляем имя файла после обратной косой черты: ${answer}.`],[`Папка назначения: ${folder}`],'Запиши полный путь после перемещения.',{from,folder,file});
  });
  model('file-mask','Отбор файлов по маске','base','Файлы и Интернет',['Маски имён файлов'],2,3,i=>{
    if(i>29){
      const j=i-30,prefix=['data','lab','work','plan','class','map','text','image','code','sound'][j%10],patterns=[
        [`${prefix}?.txt`,[`${prefix}A.txt`,`${prefix}12.txt`,`${prefix}3.txt`,`${prefix}B.png`]],
        [`${prefix}??.txt`,[`${prefix}AB.txt`,`${prefix}A.txt`,`${prefix}123.txt`,`${prefix}Z9.txt`]],
        [`${prefix}*.txt`,[`${prefix}.txt`,`${prefix}12.txt`,`${prefix}A.txt`,`${prefix}.csv`]],
        [`${prefix}_?.?xt`,[`${prefix}_A.txt`,`${prefix}_B.pxt`,`${prefix}_12.txt`,`${prefix}_A.text`]],
        [`${prefix}??.csv`,[`${prefix}AB.csv`,`${prefix}A.csv`,`${prefix}123.csv`,`${prefix}AB.txt`]],
        [`?${prefix}*.txt`,[`A${prefix}.txt`,`B${prefix}12.txt`,`${prefix}.txt`,`A${prefix}.pdf`]],
        [`${prefix}*?.dat`,[`${prefix}.dat`,`${prefix}X.dat`,`${prefix}ABC.dat`,`${prefix}X.txt`]],
        [`${prefix}?.*`,[`${prefix}A.txt`,`${prefix}B.csv`,`${prefix}CD.txt`,`${prefix}.txt`]]
      ],[mask,options]=patterns[Math.floor(j/10)],regex=new RegExp('^'+mask.replace(/[.]/g,'\\.').replace(/\*/g,'.*').replace(/\?/g,'.')+'$'),correct=options.filter(name=>regex.test(name));
      return result(p('В маске знак ? заменяет ровно один символ, а * — любую последовательность символов, в том числе пустую. Остальные символы должны совпасть; регистр во всех именах одинаковый.')+p(`Файлы: ${options.map(esc).join(' · ')}`),[{label:'Все подходящие файлы',type:'multi',options,correct}],[`Сопоставляем каждое имя с маской ${mask}, учитывая точку и расширение.`,`Полностью соответствуют маске: ${correct.join(', ')}.`],[`Маска: ${mask}`],'Выбери все файлы, подходящие под маску.',{mask,options});
    }
    const prefix=`data${i}_`,mask=`${prefix}?.txt`,options=[`${prefix}A.txt`,`${prefix}12.txt`,`${prefix}3.txt`,`${prefix}B.png`],correct=[options[0],options[2]];
    return result(p('В маске знак ? заменяет ровно один символ. Остальные символы должны совпасть, включая точку и расширение. Регистр во всех именах одинаковый.')+p(`Файлы: ${options.map(esc).join(' · ')}`),[{label:'Все подходящие файлы',type:'multi',options,correct}],[`После ${prefix} должен стоять ровно один символ, затем .txt.`,`Подходят ${correct.join(', ')}. В имени с 12 лишний символ; .png не совпадает с .txt.`],[`Маска: ${mask}`],'Выбери все файлы, подходящие под маску.',{mask,options});
  });
  model('url-address','Составление интернет-адреса','base','Файлы и Интернет',['Интернет-адреса'],2,3,i=>{
    const j=i-30,hosts=['library','science','school','museum','robotics','math','history','nature','art','music'],folders=['files','courses/math','courses/coding','archive/2026','classes/7a','media/images','documents/notes','public/results'],files=['book.pdf','lesson.odt','scheme.svg','program.py','table.ods','photo.png','report.pdf','article.txt','poster.png','melody.wav'];
    const host=i<=29?`class${i}.example`:`${hosts[j%10]}.example`,folder=i<=29?`lesson${i+1}`:folders[Math.floor(j/10)],file=i<=29?`task${i+2}.pdf`:files[j%10],correct=`https://${host}/${folder}/${file}`,options=[correct,`https://${host}/${file}/${folder}`,i<=29?`https://${folder}.${host}/${file}`:`https://${host}/${folder.split('/').reverse().join('/')}/${file}/`, `https://${host}/${folder}/${file}.txt`];
    return result(p('Нужно составить адрес файла в указанном каталоге сервера. Домен .example используется здесь как учебный пример.'),[single('Полный адрес файла',options,correct)],[`Сначала протокол и разделитель: https://.`,`Далее имя сервера, каталог и файл через /: ${correct}.`],[`Протокол: https`,`Сервер: ${host}`,`Каталог: ${folder}`,`Файл: ${file}`],'Выбери правильный полный адрес файла.',{host,folder,file});
  });
  model('folder-volume','Объём файлов в папке','base','Файлы и Интернет',['Размеры файлов','Суммирование'],2,3,i=>{
    const counts=[i+2,3+i%4,2],sizes=[16,32,64+i*8],answer=counts.reduce((s,n,j)=>s+n*sizes[j],0);
    return result(p('Папка содержит только три перечисленные группы файлов. Размер самой папки и служебные данные не учитываются.'),[numeric('Суммарный объём в Кбайтах',answer)],[...counts.map((n,j)=>`Группа ${j+1}: ${n} × ${sizes[j]} = ${n*sizes[j]} Кбайт.`),`Сумма: ${counts.map((n,j)=>n*sizes[j]).join(' + ')} = ${answer} Кбайт.`],counts.map((n,j)=>`Группа ${j+1}: ${n} файла(ов) по ${sizes[j]} Кбайт`),'Найди суммарный объём файлов папки в Кбайтах.',{counts,sizes});
  });
  model('logic-check','Проверка логического условия','base','Алгоритмы',['Логические условия','Операции И и ИЛИ'],2,3,i=>{
    const j=i-30,left=i<=29?8+i%7:10+j,right=i<=29?25+i%5:12+j*2,a=i<=29?i+2:left+[-3,0,4,1,5,-1][j%6],b=i<=29?40-i:right+[0,3,-2,4,-1,0][Math.floor(j/6)%6],op=i%2?'И':'ИЛИ',yes=op==='И'?(a>left&&b<=right):(a>left||b<=right);
    return result(p('Операция И истинна, если истинны обе части. Операция ИЛИ истинна, если истинна хотя бы одна часть.')+`<pre>(a &gt; ${left}) ${op} (b &lt;= ${right})</pre>`,[single('Условие истинно?', ['ДА','НЕТ'],yes?'ДА':'НЕТ')],[`a > ${left}: ${a} > ${left} — ${a>left?'истина':'ложь'}.`,`b ≤ ${right}: ${b} ≤ ${right} — ${b<=right?'истина':'ложь'}.`,`Соединяем через ${op}: ${yes?'ДА':'НЕТ'}.`],[`a = ${a}`,`b = ${b}`],'Будет ли всё условие истинным?',{a,b,left,right,op});
  });
  model('logic-interval','Целые числа и логика','advanced','Логика и кодирование',['Логические условия','Подсчёт значений'],2,4,i=>{
    const j=i-30,left=i<=29?2+i%6:4+j*2,right=i<=29?12+i%8:left+8+j%11,end=i<=29?20+i:right-j%4,divisor=i<=29?i%3+2:2+j%7,values=Array.from({length:end+1},(_,x)=>x).filter(x=>x>left&&x<right&&x%divisor!==0);
    return result(p('Рассматриваются все целые числа x в указанном диапазоне. Все три требования должны выполняться одновременно.'),[numeric('Количество подходящих чисел',values.length)],[i<=29?`Между границами: от ${left+1} до ${right-1}.`:`Пересекаем диапазон с двумя неравенствами: от ${left+1} до ${Math.min(end,right-1)}.`,`Исключаем кратные ${divisor}. Остаются: ${values.join(', ')}.`,`Всего ${values.length} чисел.`],[`0 ≤ x ≤ ${end}`,`x > ${left}`,`x < ${right}`,`x не делится на ${divisor} без остатка`],'Сколько чисел удовлетворяют всем требованиям?',{end,left,right,divisor});
  });
  model('logic-grid','Таблица пар и условие','advanced','Алгоритмы',['Логические условия','Перебор пар'],2,4,i=>{
    const j=i-30,s=i<=29?[i,i+2,i+4]:[j+1,j+4,j+8],k=i<=29?[i%5,i%5+3,i%5+6]:[j%7+1,j%7+4,j%7+9],sLimit=i<=29?i+2:j+[0,2,5,9][j%4],kLimit=i<=29?i%5+3:j%7+[0,3,6,10][Math.floor(j/4)%4],op=i%2?'and':'or';
    const pairs=s.flatMap(a=>k.map(b=>[a,b])),yes=pairs.filter(([a,b])=>op==='and'?(a<=sLimit&&b>kLimit):(a<=sLimit||b>kLimit));
    return result(p('Программу запускают для каждой пары из двух наборов: каждое значение s соединяют с каждым значением k. Всего 9 запусков. and означает «И», or — «ИЛИ».')+`<pre class="python">if s &lt;= ${sLimit} ${op} k &gt; ${kLimit}:
    print("ДА")
else:
    print("НЕТ")</pre>`,[numeric('Число ответов ДА',yes.length)],[`Проверяем все 3 × 3 = 9 пар.`,`Ответ ДА дают пары: ${yes.map(([a,b])=>`(${a}, ${b})`).join('; ')}.`,`Всего ${yes.length} запусков.`],[`s: ${s.join(', ')}`,`k: ${k.join(', ')}`],'При скольких запусках программа напечатает ДА?',{s,k,sLimit,kLimit,op});
  });
  model('linear-algorithm','Последовательность команд','base','Алгоритмы',['Линейные алгоритмы'],1,2,i=>{
    const start=i+4,multiplier=2+i%4,add=3+i%5,subtract=i%7,answer=start*multiplier+add-subtract;
    return result(p('Исполнитель начинает с заданного числа и выполняет команды строго по порядку.'),[numeric('Итоговое число',answer)],[`После умножения: ${start} × ${multiplier} = ${start*multiplier}.`,`После прибавления: ${start*multiplier} + ${add} = ${start*multiplier+add}.`,`После вычитания: ${start*multiplier+add} − ${subtract} = ${answer}.`],[`Начальное число ${start}`,`1. Умножить на ${multiplier}`,`2. Прибавить ${add}`,`3. Вычесть ${subtract}`],'Какое число получится?',{start,multiplier,add,subtract});
  });
  model('loop-sum','Сумма в цикле с шагом','advanced','Алгоритмы',['Циклы','Суммирование'],2,4,i=>{
    const start=1+i%3,stop=i+12,step=2+i%2,values=[];for(let n=start;n<stop;n+=step)values.push(n);const answer=values.reduce((a,b)=>a+b,0);
    return result(p('В Python range(start, stop, step) перебирает числа от start с шагом step, не включая stop.')+`<pre class="python">s = 0
for x in range(${start}, ${stop}, ${step}):
    s = s + x
print(s)</pre>`,[numeric('Вывод программы',answer)],[`Значения x: ${values.join(', ')}.`,`Сумма: ${values.join(' + ')} = ${answer}.`],[`Начало ${start}; граница ${stop}; шаг ${step}`],'Какое число выведет программа?',{start,stop,step});
  });
  model('conditional-sum','Сумма с проверкой остатка','advanced','Алгоритмы',['Циклы','Остаток от деления','Суммирование'],3,5,i=>{
    const stop=i+15,divisor=2+i%4,values=Array.from({length:stop},(_,x)=>x).filter(x=>x%divisor===0),answer=values.reduce((a,b)=>a+b,0);
    return result(p('Оператор % возвращает остаток от деления. В переменную s прибавляется значение x только при выполнении условия.')+`<pre class="python">s = 0
for x in range(${stop}):
    if x % ${divisor} == 0:
        s = s + x
print(s)</pre>`,[numeric('Вывод программы',answer)],[`Подходят x: ${values.join(', ')}.`,`Их сумма равна ${answer}; это не количество подходящих чисел.`],[`0 ≤ x < ${stop}`,`Делитель ${divisor}`],'Какое число выведет программа?',{stop,divisor},{[values.length]:'Здесь к s прибавляется само x. Нужно найти сумму, а не число подходящих значений.'});
  });
  model('while-counter','Число повторений while','advanced','Алгоритмы',['Цикл while','Трассировка'],3,5,i=>{
    const start=i%4,step=2+i%5,limit=20+i*3;let x=start,count=0;while(x<limit){x+=step;count++;}
    return result(p('Условие while проверяется перед каждым повторением. Переменная n считает выполненные повторения.')+`<pre class="python">x = ${start}
n = 0
while x &lt; ${limit}:
    x = x + ${step}
    n = n + 1
print(n)</pre>`,[numeric('Вывод программы',count)],[`После k повторений x = ${start} + ${step} × k.`,`Первое значение не меньше ${limit}: x = ${x} при k = ${count}.`,`До него x = ${x-step} < ${limit}. Ответ: ${count}.`],[`Начальное x = ${start}`,`Шаг ${step}; граница ${limit}`],'Сколько повторений выполнится?',{start,step,limit});
  });
  model('division-remainder','Целая часть и остаток','advanced','Алгоритмы',['Целочисленное деление','Остаток от деления'],2,3,i=>{
    const n=31+i*7,d=3+i%7,q=Math.floor(n/d),r=n%d;
    return result(p('Для положительных целых чисел // даёт целую часть частного, % — остаток от деления.')+`<pre class="python">n = ${n}
d = ${d}
s = n // d + n % d
print(s)</pre>`,[numeric('Вывод программы',q+r)],[`${n} = ${d} × ${q} + ${r}.`,`n // d = ${q}, n % d = ${r}.`,`Программа выведет ${q} + ${r} = ${q+r}.`],[`n = ${n}`,`d = ${d}`],'Какое число выведет программа?',{n,d});
  });
  model('fixed-decoding','Декодирование блоками','base','Логика и кодирование',['Декодирование','Двоичный код'],2,3,i=>{
    const alphabet=['А','Б','В','Г'],number=i+96,binary=number.toString(2).padStart(10,'0'),chunks=binary.match(/.{2}/g),answer=chunks.map(c=>alphabet[parseInt(c,2)]).join('');
    return result(p('Каждая буква кодируется ровно двумя битами. Декодируй всю цепочку слева направо; результат — последовательность букв, а не обязательно слово.')+`<pre>${binary}</pre><div class="code-table">${alphabet.map((a,n)=>`<span>${a}<b>${n.toString(2).padStart(2,'0')}</b></span>`).join('')}</div>`,[text('Последовательность букв',answer)],[`Разбиение на пары: ${chunks.join(' / ')}.`,`По таблице получаем ${answer}.`],['00 → А; 01 → Б; 10 → В; 11 → Г'],'Запиши полученную последовательность букв.',{binary,alphabet});
  });
  model('text-replace','Замена фрагментов текста','base','Графика и текст',['Поиск и замена','Подсчёт символов'],2,4,i=>{
    const tokens=i<=29?Array.from({length:4+i%5},(_,j)=>(i+j)%3===0?'код':(i+j)%3===1?'дом':'кот'):['код',...Array.from({length:6},(_,j)=>['код','дом','кот'][Math.floor((i-30)/3**j)%3])];if(i<=29)tokens.splice(i%tokens.length,0,`тема${i}`);const phrase=tokens.join(' '),from='код',to='программа',occurrences=tokens.filter(t=>t===from).length,answer=phrase.split(from).join(to).length;
    return result(p('Выполнили замену всех вхождений «код» на «программа». Остальные символы, включая пробелы и цифры, остались прежними. Кавычки не входят в текст.')+`<blockquote>${esc(phrase)}</blockquote>`,[numeric('Символов после замены',answer)],[`В исходном тексте ${phrase.length} символов.`,`Найдено замен: ${occurrences}. Каждая добавляет ${to.length-from.length} символов.`,`${phrase.length} + ${occurrences} × ${to.length-from.length} = ${answer}.`],['Заменить все вхождения','Пробелы и цифры учитываются'],'Сколько символов стало после замены?',{phrase,from,to});
  });
  model('table-grid','Строки и столбцы таблицы','base','Графика и текст',['Абзацы и таблицы','Структура таблицы'],1,3,i=>{
    const rows=i+3,columns=2+i%7,addRows=1,addColumns=2,answer=(rows+addRows)*(columns+addColumns);
    return result(p('В прямоугольную таблицу добавили одну строку и два столбца. Ячейки не объединяли и не разделяли.'),[numeric('Количество ячеек',answer)],[`Строк стало ${rows} + 1 = ${rows+1}.`,`Столбцов стало ${columns} + 2 = ${columns+2}.`,`Ячеек: ${rows+1} × ${columns+2} = ${answer}.`],[`Было ${rows} строки(ок) и ${columns} столбца(ов)`],'Сколько отдельных ячеек стало в таблице?',{rows,columns,addRows,addColumns});
  });

  return function extend(C){
    if(C.bank.some(b=>b.id==='pack-kilobytes-1'))return;
    if(models.length!==32)throw Error('Неверное количество моделей банка.');
    const packs=[];
    // Finite models are capped: device-roles repeats after 60 combinations;
    // input-devices has 250 sets, fixed-decoding has 927 complete 10-bit chains.
    // Every previous ID keeps its exact condition, key, explanation and metadata.
    const counts={kilobytes:103,'bytes-bits':103,'ram-free':103,'files-fit':102,'phrase-size':102,'alphabet-bits':105,'message-length':105,recoding:105,'transfer-volume':105,'two-connections':105,'raster-size':105,'palette-size':105,'input-devices':102,'device-roles':60,'pixel-scale':102,'sound-duration':105,'sound-change':105,'file-move':102,'file-mask':102,'url-address':102,'folder-volume':102,'logic-check':102,'logic-interval':105,'logic-grid':104,'linear-algorithm':102,'loop-sum':104,'conditional-sum':104,'while-counter':104,'division-remainder':104,'fixed-decoding':102,'text-replace':102,'table-grid':102};
    for(const m of models){
      const count=counts[m.id];
      packs.push({id:m.id,title:m.title,level:m.level,topic:m.topic,count});
      for(let i=1;i<=count;i++){
        const id=`pack-${m.id}-${i}`,t=m.build(i);
        t.body+=p(`<span class="given">${t.given.map(esc).join(' · ')}</span>`)+p(esc(t.prompt));
        Object.assign(t,{title:`${m.title} · ${String(i).padStart(2,'0')}`,topic:m.topic,bankId:id,family:`pack-${m.id}`,skills:[...m.skills],difficulty:m.difficulty,estimatedMinutes:m.minutes,generated:true,authored:true,sourceStatus:'authored',source:`Авторская учебная модель «${m.title}», версия ${i}. Условие и ключ созданы для тренажёра 1430.`,adapted:false});
        t.verification.model=m.id;
        C.bank.push({id,level:m.level,number:i,task:t,label:`${m.level==='base'?'Базовый':'Углублённый'} · ${m.title} · ${i}`});
      }
    }
    C.taskPacks=packs;
    C.bankStats={total:C.bank.length,source:C.bank.filter(b=>!b.task.generated).length,practice:C.bank.filter(b=>b.task.generated).length,authored:C.bank.filter(b=>b.task.authored).length,practiceFamilies:new Set(C.bank.filter(b=>b.task.generated).map(b=>b.task.family)).size,families:new Set(C.bank.map(b=>b.task.family)).size};
    for(const b of C.bank)b.searchText=[b.id,b.label,b.task.title,b.task.topic,...b.task.skills,...b.task.given].join(' ').toLowerCase().replace(/ё/g,'е');
  };
});
